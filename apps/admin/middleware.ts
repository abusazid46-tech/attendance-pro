import { NextResponse, type NextRequest } from "next/server";

const adminTokenCookie = "attendance_admin_token";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(adminTokenCookie)?.value;
  const isLogin = request.nextUrl.pathname === "/login";

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (token && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
