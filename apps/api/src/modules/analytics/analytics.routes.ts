import { AttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get(
  "/faculty-dashboard",
  asyncHandler(async (_req, res) => {
    const totalClasses = await prisma.attendance.groupBy({ by: ["subjectId", "date"], _count: true });
    const totalRecords = await prisma.attendance.count();
    const presentRecords = await prisma.attendance.count({ where: { status: AttendanceStatus.PRESENT } });
    const studentsBelowThreshold = await prisma.student.count();

    res.json({
      cards: {
        todayClasses: totalClasses.length,
        totalStudents: await prisma.student.count(),
        attendancePercentage: totalRecords ? Math.round((presentRecords / totalRecords) * 100) : 0,
        pendingAttendance: 0
      },
      teacherAnalytics: {
        totalClassesConducted: totalClasses.length,
        attendanceAverage: totalRecords ? Math.round((presentRecords / totalRecords) * 100) : 0,
        studentsBelowThreshold,
        topPerformingSections: [{ section: "A", percentage: 92 }],
        subjectPerformance: [{ subject: "Programming Fundamentals", percentage: 88 }]
      },
      charts: {
        presentVsAbsent: [
          { name: "Present", value: presentRecords },
          { name: "Absent", value: await prisma.attendance.count({ where: { status: AttendanceStatus.ABSENT } }) }
        ],
        monthlyTrend: [{ month: "Jun", percentage: 88 }],
        subjectWise: [{ subject: "CS101", percentage: 88 }],
        heatmap: [{ day: "Mon", value: 86 }]
      }
    });
  })
);

analyticsRouter.get(
  "/students/:studentId",
  asyncHandler(async (req, res) => {
    const studentId = req.params.studentId as string;
    const records = await prisma.attendance.findMany({ where: { studentId }, include: { subject: true } });
    const total = records.length;
    const present = records.filter((item) => item.status === "PRESENT").length;
    const absent = records.filter((item) => item.status === "ABSENT").length;
    const bySubject = Object.values(
      records.reduce<Record<string, { subject: string; total: number; present: number }>>((acc, item) => {
        const subject = (acc[item.subjectId] ??= { subject: item.subject.name, total: 0, present: 0 });
        subject.total += 1;
        if (item.status === "PRESENT") subject.present += 1;
        return acc;
      }, {})
    ).map((item) => ({ ...item, percentage: item.total ? Math.round((item.present / item.total) * 100) : 0 }));

    res.json({
      overallAttendancePercentage: total ? Math.round((present / total) * 100) : 0,
      subjectWiseAttendance: bySubject,
      totalPresent: present,
      totalAbsent: absent,
      totalClasses: total
    });
  })
);
