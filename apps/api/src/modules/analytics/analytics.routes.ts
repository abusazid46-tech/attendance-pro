import { AttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

analyticsRouter.get(
  "/faculty-dashboard",
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({
      where: req.user?.role === "FACULTY" ? { userId: req.user.sub } : undefined,
      include: { user: { select: { fullName: true, email: true, mobileNumber: true } }, department: true, academicSessions: { orderBy: { startsOn: "desc" } } }
    });
    const totalClasses = await prisma.attendance.groupBy({ by: ["subjectId", "date"], _count: true });
    const totalRecords = await prisma.attendance.count();
    const presentRecords = await prisma.attendance.count({ where: { status: AttendanceStatus.PRESENT } });
    const studentsBelowThreshold = await prisma.student.count();

    res.json({
      teacherProfile: teacher
        ? {
            id: teacher.id,
            teacherId: teacher.id,
            name: teacher.user.fullName,
            email: teacher.user.email,
            mobileNumber: teacher.user.mobileNumber,
            designation: teacher.designation,
            institutionName: teacher.institutionName,
            department: teacher.department.name,
            academicSession: teacher.academicSessions[0]?.name
          }
        : undefined,
      academicSessions: teacher?.academicSessions ?? [],
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
        topPerformingSections: [],
        subjectPerformance: []
      },
      charts: {
        presentVsAbsent: [
          { name: "Present", value: presentRecords },
          { name: "Absent", value: await prisma.attendance.count({ where: { status: AttendanceStatus.ABSENT } }) }
        ],
        monthlyTrend: [],
        subjectWise: [],
        heatmap: []
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
