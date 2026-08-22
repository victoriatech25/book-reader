"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HomeIcon, LibraryIcon, PlusIcon, SettingsIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  {
    href: "/",
    label: "홈",
    icon: HomeIcon,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/library",
    label: "서재",
    icon: LibraryIcon,
    isActive: (pathname: string) => pathname.startsWith("/library"),
  },
  {
    href: "/books/new",
    label: "책 등록",
    icon: PlusIcon,
    isActive: (pathname: string) => pathname.startsWith("/books/new"),
  },
  {
    href: "/settings",
    label: "설정",
    icon: SettingsIcon,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  // 로그인 및 인증 관련 화면에서는 하단 탭 바를 띄우지 않는다.
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav
      aria-label="하단 네비게이션"
      className="bg-background/90 border-border fixed right-0 bottom-0 left-0 z-40 border-t backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors active:scale-95 ${
                active
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`flex size-7 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <Icon className="size-5" />
              </div>
              <span className="mt-0.5 text-[11px] leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
