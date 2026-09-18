/**
 * 애플리케이션 기본 경로 (서브패스).
 *
 * AWS EC2 배포 시 victoria-tech.com/reader 경로로 서비스되므로 "/reader" 로 지정한다.
 */
export const BASE_PATH = "/reader";

/**
 * 기본 경로(BASE_PATH)를 붙인 절대 경로를 반환한다.
 * 이미 BASE_PATH로 시작하는 경우 중복해서 붙이지 않는다.
 */
export function withBasePath(path: string): string {
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${cleanPath}`;
}
