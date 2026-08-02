import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { HomeIcon } from "@/components/ui/icons";
import { quietLink } from "@/components/ui/styles";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase/server";

import { BackupManager } from "./backup-manager";
import { CategoryManager } from "./category-manager";
import { ShelfManager } from "./shelf-manager";
import { TagManager } from "./tag-manager";

export const metadata: Metadata = { title: "설정 · 독서대" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabaseClient();

  // 각 분류에 몇 권이 달려 있는지 함께 센다. "이걸 지우면 뭐가 영향받나"를
  // 삭제 확인 문구에 넣으려면 개수가 필요하다.
  const [{ data: categories }, { data: tags }, { data: shelves }, { data: books }] =
    await Promise.all([
      supabase.from("categories").select("id, name, color, sort_order").order("sort_order"),
      supabase.from("tags").select("id, name, book_tags(book_id)").order("name"),
      supabase
        .from("shelves")
        .select("id, name, description, shelf_books(book_id)")
        .order("sort_order"),
      supabase.from("books").select("category_id"),
    ]);

  const booksPerCategory = new Map<string, number>();
  for (const book of books ?? []) {
    if (!book.category_id) continue;
    booksPerCategory.set(book.category_id, (booksPerCategory.get(book.category_id) ?? 0) + 1);
  }

  return (
    <div className="bg-background flex flex-1 justify-center px-6 py-12">
      <main id="main" className="w-full max-w-xl">
        <Link href="/" className={quietLink}>
          <HomeIcon />홈
        </Link>
        <h1 className="text-foreground mt-4 text-2xl font-semibold tracking-tight">설정</h1>
        <p className="text-muted-foreground mt-2 mb-10 text-sm">
          분야·태그·서재를 정리하고, 테마를 고르고, 기록을 백업합니다. 목표는 대시보드에 있습니다.
        </p>

        <div className="space-y-12">
          <section>
            <h2 className="text-foreground text-base font-semibold">테마</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              기본은 시스템 설정을 따릅니다. 직접 고르면 OS와 무관하게 고정됩니다.
            </p>
            <div className="mt-3">
              <ThemeToggle idPrefix="settings-theme" />
            </div>
          </section>

          <CategoryManager
            categories={(categories ?? []).map((category) => ({
              ...category,
              bookCount: booksPerCategory.get(category.id) ?? 0,
            }))}
          />

          <TagManager
            tags={(tags ?? []).map((tag) => ({
              id: tag.id,
              name: tag.name,
              bookCount: tag.book_tags.length,
            }))}
          />

          <ShelfManager
            shelves={(shelves ?? []).map((shelf) => ({
              id: shelf.id,
              name: shelf.name,
              description: shelf.description,
              bookCount: shelf.shelf_books.length,
            }))}
          />

          <BackupManager />
        </div>
      </main>
    </div>
  );
}
