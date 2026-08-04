import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const academicsRouter = Router();
academicsRouter.use(authenticate);

const codeFromName = (value: string, fallback: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12) || fallback;

const getTeacher = (userId?: string) => prisma.teacher.findFirst({ where: userId ? { userId } : undefined });

const ensureCourse = async (departmentId: string, name = "General Course") =>
  prisma.course.upsert({
    where: { code: `${codeFromName(name, "COURSE")}-${departmentId.slice(-4)}`.slice(0, 20) },
    update: { name, departmentId },
    create: { name, code: `${codeFromName(name, "COURSE")}-${departmentId.slice(-4)}`.slice(0, 20), departmentId }
  });

const ensureSection = async (semesterId: string, name = "A") => {
  const existing = await prisma.section.findFirst({ where: { semesterId, name } });
  return existing ?? prisma.section.create({ data: { semesterId, name } });
};

academicsRouter.get(
  "/hierarchy",
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      include: {
        courses: { include: { semesters: { include: { sections: { include: { subjects: true } } } } } }
      },
      orderBy: { name: "asc" }
    });
    const courses = departments.flatMap((department) => department.courses);
    const semesters = courses.flatMap((course) => course.semesters);
    const sections = semesters.flatMap((semester) => semester.sections);
    const subjects = sections.flatMap((section) => section.subjects);
    res.json({ departments, courses, semesters, sections, subjects });
  })
);

academicsRouter.post(
  "/departments",
  allowRoles("SUPER_ADMIN", "ADMIN"),
  validate(z.object({ body: z.object({ name: z.string().min(2), code: z.string().min(2).max(12) }) })),
  asyncHandler(async (req, res) => {
    const department = await prisma.department.create({ data: req.body });
    res.status(201).json({ department });
  })
);

academicsRouter.get(
  "/teacher-workspace",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({
      where: req.user?.role === "FACULTY" ? { userId: req.user.sub } : undefined,
      include: {
        user: { select: { fullName: true, email: true, mobileNumber: true } },
        department: true,
        academicSessions: { orderBy: { startsOn: "desc" } },
        subjects: {
          include: {
            semester: true,
            section: true,
            enrollments: { include: { student: { include: { user: { select: { fullName: true } } } } } }
          },
          orderBy: { code: "asc" }
        }
      }
    });

    res.json({ teacher });
  })
);

academicsRouter.patch(
  "/teacher-profile",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2),
        designation: z.string().min(2),
        departmentId: z.string().min(1).optional(),
        department: z.string().min(2).optional(),
        institutionName: z.string().min(2),
        mobileNumber: z.string().min(8).optional(),
        email: z.string().email()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await getTeacher(req.user?.role === "FACULTY" ? req.user.sub : undefined);
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });
    const department =
      req.body.departmentId
        ? await prisma.department.findUnique({ where: { id: req.body.departmentId } })
        : req.body.department
          ? await prisma.department.upsert({
              where: { code: codeFromName(req.body.department, "DEPT") },
              update: { name: req.body.department },
              create: { name: req.body.department, code: codeFromName(req.body.department, "DEPT") }
            })
          : null;

    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        designation: req.body.designation,
        institutionName: req.body.institutionName,
        departmentId: department?.id ?? teacher.departmentId,
        user: {
          update: {
            fullName: req.body.name,
            email: req.body.email,
            mobileNumber: req.body.mobileNumber
          }
        }
      },
      include: { user: { select: { fullName: true, email: true, mobileNumber: true } }, department: true }
    });

    res.json({ teacher: updated });
  })
);

academicsRouter.post(
  "/semesters",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2),
        number: z.number().int().positive().optional(),
        courseId: z.string().optional(),
        sectionName: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await getTeacher(req.user?.role === "FACULTY" ? req.user.sub : undefined);
    const departmentId = teacher?.departmentId ?? (await prisma.department.findFirst({ orderBy: { createdAt: "asc" } }))?.id;
    if (!departmentId) return res.status(422).json({ message: "Create a department or teacher profile first" });
    const course = req.body.courseId ? await prisma.course.findUniqueOrThrow({ where: { id: req.body.courseId } }) : await ensureCourse(departmentId);
    const number = req.body.number ?? Number(req.body.name.match(/\d+/)?.[0] ?? 1);
    const existing = await prisma.semester.findFirst({ where: { courseId: course.id, number } });
    const semester = existing ?? (await prisma.semester.create({ data: { name: req.body.name, number, courseId: course.id } }));
    const section = await ensureSection(semester.id, req.body.sectionName ?? "A");
    if (teacher) await prisma.teacher.update({ where: { id: teacher.id }, data: { sections: { connect: { id: section.id } } } });
    res.status(existing ? 200 : 201).json({ semester, section, course });
  })
);

academicsRouter.post(
  "/sessions",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(4),
        startsOn: z.coerce.date(),
        endsOn: z.coerce.date(),
        isActive: z.boolean().default(true)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: req.user?.role === "FACULTY" ? { userId: req.user.sub } : undefined });
    const session = await prisma.academicSession.create({ data: { ...req.body, teacherId: teacher?.id } });
    res.status(201).json({ session });
  })
);

academicsRouter.post(
  "/subjects",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        code: z.string().min(2),
        name: z.string().min(2),
        departmentId: z.string().min(1),
        semesterId: z.string().min(1),
        sectionId: z.string().min(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: req.user?.role === "FACULTY" ? { userId: req.user.sub } : undefined });
    const subject = await prisma.subject.create({
      data: {
        ...req.body,
        teachers: teacher ? { connect: { id: teacher.id } } : undefined
      }
    });
    res.status(201).json({ subject });
  })
);

academicsRouter.put(
  "/subjects/:subjectId",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      params: z.object({ subjectId: z.string().min(1) }),
      body: z.object({
        code: z.string().min(2),
        name: z.string().min(2),
        departmentId: z.string().min(1),
        semesterId: z.string().min(1),
        sectionId: z.string().min(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.update({ where: { id: req.params.subjectId }, data: req.body });
    res.json({ subject });
  })
);

academicsRouter.delete(
  "/subjects/:subjectId",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ params: z.object({ subjectId: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    await prisma.subject.delete({ where: { id: req.params.subjectId } });
    res.json({ message: "Subject deleted" });
  })
);

academicsRouter.post(
  "/subject-enrollments",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        subjectId: z.string().min(1),
        semesterId: z.string().min(1),
        studentIds: z.array(z.string().min(1)).min(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.$transaction(
      req.body.studentIds.map((studentId: string) =>
        prisma.studentSubjectEnrollment.upsert({
          where: { studentId_subjectId: { studentId, subjectId: req.body.subjectId } },
          update: { semesterId: req.body.semesterId },
          create: { studentId, subjectId: req.body.subjectId, semesterId: req.body.semesterId }
        })
      )
    );

    res.status(201).json({ enrollments });
  })
);
