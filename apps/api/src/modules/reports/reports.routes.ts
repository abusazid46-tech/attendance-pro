import { Router } from "express";
import { z } from "zod";
import { AttendanceStatus, ReportFormat, ReportType } from "@prisma/client";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, allowRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate, allowRoles("SUPER_ADMIN", "ADMIN", "FACULTY"));

reportsRouter.get(
  "/daily",
  validate(z.object({ query: z.object({ date: z.string(), sectionId: z.string().optional(), subjectId: z.string().optional(), format: z.enum(["json", "csv"]).default("json") }) })),
  asyncHandler(async (req, res) => {
    const start = new Date(req.query.date as string);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: start, lt: end },
        sectionId: typeof req.query.sectionId === "string" ? req.query.sectionId : undefined,
        subjectId: typeof req.query.subjectId === "string" ? req.query.subjectId : undefined
      },
      include: { student: { include: { user: true } }, subject: true }
    });

    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      return res.send(["student,subject,status,date", ...records.map((r) => `${r.student.user.fullName},${r.subject.code},${r.status},${r.date.toISOString()}`)].join("\n"));
    }

    res.json({ records });
  })
);

reportsRouter.get(
  "/defaulters",
  validate(z.object({ query: z.object({ subjectId: z.string().optional(), threshold: z.coerce.number().default(75) }) })),
  asyncHandler(async (req, res) => {
    const threshold = Number(req.query.threshold ?? 75);
    const records = await prisma.attendance.findMany({
      where: { subjectId: typeof req.query.subjectId === "string" ? req.query.subjectId : undefined },
      include: { student: { include: { user: true } }, subject: true }
    });

    const students = Object.values(
      records.reduce<Record<string, { id: string; rollNumber: string; name: string; subject: string; total: number; attended: number }>>((acc, item) => {
        const student = (acc[item.studentId] ??= {
          id: item.studentId,
          rollNumber: item.student.rollNumber,
          name: item.student.user.fullName,
          subject: item.subject.code,
          total: 0,
          attended: 0
        });
        student.total += 1;
        if (item.status === AttendanceStatus.PRESENT || item.status === AttendanceStatus.LATE) student.attended += 1;
        return acc;
      }, {})
    )
      .map((item) => ({ ...item, percentage: item.total ? Math.round((item.attended / item.total) * 100) : 0 }))
      .filter((item) => item.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage);

    res.json({ threshold, students });
  })
);

reportsRouter.post(
  "/generate",
  validate(
    z.object({
      body: z.object({
        teacherId: z.string(),
        type: z.nativeEnum(ReportType),
        format: z.nativeEnum(ReportFormat),
        title: z.string().min(2),
        filters: z.record(z.unknown()).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const report = await prisma.generatedReport.create({ data: req.body });
    res.status(201).json({
      report,
      message:
        req.body.type === ReportType.TEACHING_DIARY
          ? "Teaching diary and attendance register queued for export"
          : "Attendance report queued for export"
    });
  })
);

reportsRouter.post(
  "/share-message",
  validate(
    z.object({
      body: z.object({
        studentName: z.string().min(2),
        subjectCode: z.string().min(2),
        attendancePercentage: z.number(),
        minimumRequired: z.number().default(75),
        channel: z.enum(["WHATSAPP", "EMAIL", "TELEGRAM"])
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const { studentName, subjectCode, attendancePercentage, minimumRequired, channel } = req.body;
    const message = `Dear ${studentName}, your attendance in ${subjectCode} is ${attendancePercentage}%. Minimum required attendance is ${minimumRequired}%. Please improve your attendance.`;
    res.json({ channel, message });
  })
);
