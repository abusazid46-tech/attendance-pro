import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const permissions: Record<RoleName, string[]> = {
    SUPER_ADMIN: ["*"],
    ADMIN: ["users:*", "academics:*", "attendance:read", "reports:*"],
    FACULTY: ["attendance:create", "attendance:update:own", "analytics:own", "leave:review"],
    STUDENT: ["attendance:read:self", "leave:create"],
    PARENT: ["attendance:read:child"]
  };

  const roles = await Promise.all(
    Object.entries(permissions).map(([name, rolePermissions]) =>
      prisma.role.upsert({
        where: { name: name as RoleName },
        update: { permissions: rolePermissions },
        create: { name: name as RoleName, permissions: rolePermissions }
      })
    )
  );

  const role = (name: RoleName) => roles.find((item) => item.name === name)!;
  const passwordHash = await bcrypt.hash("Password@123", 12);

  const department = await prisma.department.upsert({
    where: { id: "seed-department-1" },
    update: { name: "Library and Information Science", code: "LIS" },
    create: { id: "seed-department-1", name: "Library and Information Science", code: "LIS" }
  });

  const course = await prisma.course.upsert({
    where: { id: "seed-course-1" },
    update: { name: "Master of Library and Information Science", code: "MLIS", departmentId: department.id },
    create: { id: "seed-course-1", name: "Master of Library and Information Science", code: "MLIS", departmentId: department.id }
  });

  const semester = await prisma.semester.upsert({
    where: { id: "seed-semester-1" },
    update: { name: "Semester II", number: 2, courseId: course.id },
    create: { id: "seed-semester-1", name: "Semester II", number: 2, courseId: course.id }
  });
  const section = await prisma.section.upsert({
    where: { id: "seed-section-1" },
    update: {},
    create: { id: "seed-section-1", name: "A", semesterId: semester.id }
  });
  const subject = await prisma.subject.upsert({
    where: { id: "seed-subject-1" },
    update: { name: "Information Sources", code: "LIS202", departmentId: department.id, semesterId: semester.id, sectionId: section.id },
    create: { id: "seed-subject-1", name: "Information Sources", code: "LIS202", departmentId: department.id, semesterId: semester.id, sectionId: section.id }
  });
  await prisma.subject.upsert({
    where: { code: "LIS201" },
    update: { name: "Knowledge Organization", departmentId: department.id, semesterId: semester.id, sectionId: section.id },
    create: { id: "seed-subject-2", name: "Knowledge Organization", code: "LIS201", departmentId: department.id, semesterId: semester.id, sectionId: section.id }
  });
  await prisma.subject.upsert({
    where: { code: "LIS203" },
    update: { name: "ICT Applications", departmentId: department.id, semesterId: semester.id, sectionId: section.id },
    create: { id: "seed-subject-3", name: "ICT Applications", code: "LIS203", departmentId: department.id, semesterId: semester.id, sectionId: section.id }
  });

  await prisma.academicSession.upsert({
    where: { id: "seed-session-1" },
    update: {},
    create: { id: "seed-session-1", name: "2026-2027", startsOn: new Date("2026-07-01"), endsOn: new Date("2027-06-30"), isActive: true }
  });

  await prisma.user.upsert({
    where: { email: "superadmin@attendance.local" },
    update: {},
    create: { email: "superadmin@attendance.local", fullName: "Super Admin", passwordHash, roleId: role("SUPER_ADMIN").id }
  });

  await prisma.user.upsert({
    where: { email: "admin@attendance.local" },
    update: {},
    create: { email: "admin@attendance.local", fullName: "Institute Admin", passwordHash, roleId: role("ADMIN").id }
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@attendance.local" },
    update: {},
    create: {
      email: "teacher@attendance.local",
      mobileNumber: "9876543210",
      fullName: "Ananya Sharma",
      passwordHash,
      roleId: role("FACULTY").id
    }
  });

  const teacher = await prisma.teacher.upsert({
    where: { employeeCode: "FAC-001" },
    update: { designation: "Assistant Professor", institutionName: "Central University", departmentId: department.id },
    create: {
      id: "seed-teacher-1",
      userId: teacherUser.id,
      employeeCode: "FAC-001",
      designation: "Assistant Professor",
      institutionName: "Central University",
      departmentId: department.id,
      sections: { connect: { id: section.id } },
      subjects: { connect: { id: subject.id } }
    }
  });

  const makeStudent = async (seedId: string, fullName: string, email: string, rollNumber: string, registrationNumber: string) => {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, fullName, passwordHash, roleId: role("STUDENT").id }
    });
    return prisma.student.upsert({
      where: { registrationNumber },
      update: {},
      create: {
        id: seedId,
        userId: user.id,
        rollNumber,
        registrationNumber,
        departmentId: department.id,
        courseId: course.id,
        semesterId: semester.id,
        sectionId: section.id
      }
    });
  };

  const student = await makeStudent("seed-student-1", "Rahul Das", "student@attendance.local", "01", "REG-2026-001");
  await makeStudent("seed-student-2", "Anita Sharma", "anita@attendance.local", "02", "REG-2026-002");
  await makeStudent("seed-student-3", "Rina Das", "rina@attendance.local", "14", "REG-2026-014");
  await makeStudent("seed-student-4", "S. Ahmed", "s.ahmed@attendance.local", "21", "REG-2026-021");
  await makeStudent("seed-student-5", "Meghna Borah", "meghna@attendance.local", "27", "REG-2026-027");

  await prisma.attendance.upsert({
    where: { studentId_subjectId_date: { studentId: student.id, subjectId: subject.id, date: new Date("2026-06-15T00:00:00.000Z") } },
    update: {},
    create: {
      studentId: student.id,
      teacherId: teacher.id,
      subjectId: subject.id,
      departmentId: department.id,
      courseId: course.id,
      semesterId: semester.id,
      sectionId: section.id,
      date: new Date("2026-06-15T00:00:00.000Z"),
      status: "PRESENT"
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
