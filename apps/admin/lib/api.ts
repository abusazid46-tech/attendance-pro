const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const demo = {
  analytics: {
    cards: {
      totalStudents: 1280,
      totalTeachers: 82,
      averageAttendance: 84,
      lowAttendanceStudents: 96
    },
    trend: [
      { month: "Jan", attendance: 79 },
      { month: "Feb", attendance: 82 },
      { month: "Mar", attendance: 86 },
      { month: "Apr", attendance: 84 },
      { month: "May", attendance: 88 },
      { month: "Jun", attendance: 85 }
    ],
    subjects: [
      { subject: "CS101", attendance: 88 },
      { subject: "MATH101", attendance: 73 },
      { subject: "PHY101", attendance: 61 }
    ]
  }
};
