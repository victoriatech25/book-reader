"use client";

import { useSyncExternalStore } from "react";

import {
  isThemeChoice,
  readThemeChoice,
  STORAGE_KEY,
  storageValueFor,
  THEME_CHOICES,
  THEME_CLASSES,
  THEME_LABEL,
  themeClassFor,
  type ThemeChoice,
} from "@/lib/theme";
import { segmentItem, segmentItemActive, segmentTrack } from "./ui/styles";

/*
 * localStorage를 React 바깥 저장소로 다룬다.
 *
 * useState + useEffect로 읽으면 "이펙트에서 setState" 패턴이 되고, 서버가 그린
 * 값과 브라우저 값이 어긋나는 순간도 직접 관리해야 한다. useSyncExternalStore는
 * 서버 스냅샷을 따로 받아 하이드레이션을 맞춘 뒤 실제 값으로 다시 그린다.
 *
 * storage 이벤트는 다른 탭에서만 온다. 이 탭에서 바꾼 것은 emit()으로 알린다.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

/** 서버는 사용자의 선택을 모른다. 시스템으로 그려두고 마운트 뒤에 맞춘다. */
function getServerSnapshot(): string {
  return "";
}

/**
 * html의 테마 클래스를 맞춘다.
 *
 * 시스템이면 **아무것도 붙이지 않는다**. globals.css의 prefers-color-scheme
 * 규칙이 그때부터 먹어서 OS 설정을 CSS가 직접 따라간다.
 */
function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);

  const next = themeClassFor(choice);
  if (next) root.classList.add(next);
}

/**
 * 테마 선택 (PRD §3.1 F12).
 *
 * 첫 페인트의 깜빡임은 layout.tsx의 인라인 스크립트가 이미 막는다.
 * 여기서는 바꾸는 일만 한다.
 */
export function ThemeToggle({ idPrefix = "theme" }: { idPrefix?: string }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const choice = readThemeChoice(raw.length > 0 ? raw : null);

  function select(next: ThemeChoice) {
    const value = storageValueFor(next);
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);

    emit();
    applyTheme(next);
  }

  return (
    <fieldset className={segmentTrack}>
      <legend className="sr-only">테마</legend>

      {THEME_CHOICES.map((value) => {
        const active = choice === value;
        return (
          <span key={value}>
            <input
              type="radio"
              id={`${idPrefix}-${value}`}
              name={`${idPrefix}-choice`}
              value={value}
              checked={active}
              onChange={(event) => {
                if (isThemeChoice(event.target.value)) select(event.target.value);
              }}
              className="peer sr-only"
            />
            {/*
              라디오는 sr-only라 포커스 링이 안 보인다. 라벨이 대신 받는다
              (peer-focus-visible). 링은 outline이라 알약 모서리를 따라간다.
            */}
            <label
              htmlFor={`${idPrefix}-${value}`}
              className={`${active ? segmentItemActive : segmentItem} peer-focus-visible:outline-ring text-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2`}
            >
              {THEME_LABEL[value]}
            </label>
          </span>
        );
      })}
    </fieldset>
  );
}
