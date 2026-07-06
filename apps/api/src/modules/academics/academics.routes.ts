import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const academicsRouter = Router();
academicsRouter.use(authenticate);

academicsRouter.get(
  "/hierarchy",
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      include: {
        courses: { include: { semesters: { include: { sections: { include: { subjects: true } } } } } }
      },
      orderBy: { name: "asc" }
    });
    res.json({ departments });
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
        departmentId: z.string().min(1),
        institutionName: z.string().min(2),
        mobileNumber: z.string().min(8).optional(),
        email: z.string().email()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: req.user?.role === "FACULTY" ? { userId: req.user.sub } : undefined });
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    const updated = await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        designation: req.body.designation,
        institutionName: req.body.institutionName,
        departmentId: req.body.departmentId,
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
