import { AttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { isInsideInstitutionBoundary } from "../../lib/geofence.js";
import { ApiError, asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

const attendanceItemSchema = z.object({
  studentId: z.string().min(1),
  status: z.nativeEnum(AttendanceStatus),
  remark: z.string().optional(),
  offlineSyncId: z.string().optional()
});

const classSessionSchema = z.object({
  teacherId: z.string(),
  academicSessionId: z.string().optional(),
  subjectId: z.string(),
  departmentId: z.string(),
  courseId: z.string(),
  semesterId: z.string(),
  sectionId: z.string(),
  date: z.coerce.date(),
  classNumber: z.number().int().positive(),
  topicTaught: z.string().min(2),
  durationMinutes: z.number().int().positive(),
  assignmentGiven: z.string().optional(),
  notes: z.string().optional(),
  observations: z.string().optional()
});

attendanceRouter.get(
  "/students",
  allowRoles("SUPER_ADMIN", "ADMIN", "FACULTY"),
  validate(
    z.object({
      query: z.object({
        departmentId: z.string().optional(),
        semesterId: z.string().optional(),
        sectionId: z.string().optional(),
        subjectId: z.string().optional(),
        search: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const search = req.query.search as string | undefined;
    const students = await prisma.student.findMany({
      where: {
        departmentId: req.query.departmentId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        OR: search
          ? [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { rollNumber: { contains: search, mode: "insensitive" } },
              { registrationNumber: { contains: search, mode: "insensitive" } }
            ]
          : undefined
      },
      include: { user: { select: { fullName: true, email: true } }, section: true }
    });
    res.json({ students });
  })
);

attendanceRouter.post(
  "/classes",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ body: classSessionSchema })),
  asyncHandler(async (req, res) => {
    const { assignmentGiven, notes, observations, ...classData } = req.body;
    const classSession = await prisma.classSession.create({
      data: {
        ...classData,
        diaryEntry: {
          create: {
            topicTaught: classData.topicTaught,
            assignmentGiven,
            notes,
            observations
          }
        }
      },
      include: { diaryEntry: true, subject: true }
    });

    res.status(201).json({ classSession });
  })
);

attendanceRouter.get(
  "/calendar",
  allowRoles("SUPER_ADMIN", "ADMIN", "FACULTY"),
  validate(z.object({ query: z.object({ subjectId: z.string().optional(), month: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const month = req.query.month ? new Date(`${req.query.month}-01T00:00:00.000Z`) : new Date();
    const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

    const classes = await prisma.classSession.findMany({
      where: {
        subjectId: typeof req.query.subjectId === "string" ? req.query.subjectId : undefined,
        date: { gte: start, lt: end }
      },
      include: { attendance: true, diaryEntry: true, subject: true },
      orderBy: { date: "asc" }
    });

    res.json({
      days: classes.map((item) => ({
        date: item.date,
        subjectCode: item.subject.code,
        classNumber: item.classNumber,
        topicTaught: item.topicTaught,
        status: item.attendance.length ? "CLASS_TAKEN" : "ATTENDANCE_MISSING",
        diaryEntry: item.diaryEntry
      }))
    });
  })
);

attendanceRouter.post(
  "/",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      body: z.object({
        classSessionId: z.string().optional(),
        teacherId: z.string(),
        subjectId: z.string(),
        departmentId: z.string(),
        courseId: z.string(),
        semesterId: z.string(),
        sectionId: z.string(),
        date: z.coerce.date(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        records: z.array(attendanceItemSchema).min(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const { records, latitude, longitude, classSessionId, ...batch } = req.body;
    if (!isInsideInstitutionBoundary({ latitude, longitude })) {
      throw new ApiError(403, "Teacher is outside the configured institution boundary");
    }
    const saved = await prisma.$transaction(async (tx) => {
      const attendance = await Promise.all(
        records.map((record: z.infer<typeof attendanceItemSchema>) =>
          tx.attendance.upsert({
            where: record.offlineSyncId
              ? { offlineSyncId: record.offlineSyncId }
              : { studentId_subjectId_date: { studentId: record.studentId, subjectId: batch.subjectId, date: batch.date } },
            update: {
              status: record.status,
              remark: record.remark,
              classSessionId,
              source: record.offlineSyncId ? "OFFLINE_SYNC" : "MANUAL"
            },
            create: {
              ...batch,
              classSessionId,
              studentId: record.studentId,
              status: record.status,
              remark: record.remark,
              offlineSyncId: record.offlineSyncId
            }
          })
        )
      );
      if (classSessionId) {
        await tx.classSession.update({ where: { id: classSessionId }, data: { status: "ATTENDANCE_COMPLETED" } });
      }
      return attendance;
    });
    res.status(201).json({ message: "Attendance submitted", count: saved.length, records: saved });
  })
);

attendanceRouter.patch(
  "/:attendanceId",
  allowRoles("FACULTY", "ADMIN", "SUPER_ADMIN"),
  validate(z.object({ params: z.object({ attendanceId: z.string() }), body: z.object({ status: z.nativeEnum(AttendanceStatus), reason: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const current = await prisma.attendance.findUnique({ where: { id: req.params.attendanceId as string } });
    if (!current) throw new ApiError(404, "Attendance record not found");

    const ageHours = (Date.now() - current.createdAt.getTime()) / 36e5;
    if (ageHours > env.ATTENDANCE_EDIT_WINDOW_HOURS && req.user?.role === "FACULTY") {
      throw new ApiError(403, `Attendance can only be edited within ${env.ATTENDANCE_EDIT_WINDOW_HOURS} hours`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.attendance.update({ where: { id: current.id }, data: { status: req.body.status, remark: req.body.reason } });
      await tx.auditLog.create({
        data: {
          entityType: "Attendance",
          entityId: current.id,
          attendanceId: current.id,
          previousValue: { status: current.status },
          updatedValue: { status: req.body.status },
          updatedById: req.user!.sub,
          reason: req.body.reason
        }
      });
      return record;
    });

    res.json({ message: "Attendance updated", attendance: updated });
  })
);
