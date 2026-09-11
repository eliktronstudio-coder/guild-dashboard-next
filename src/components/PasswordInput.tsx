"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Поле пароля с кнопкой-глазом: по клику показывает введённый текст.
 * Кнопка обязательно type="button" — иначе внутри <form> она отправляла бы
 * форму вместо переключения видимости.
 */
export default function PasswordInput({ className, ...inputProps }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Скрыть пароль" : "Показать пароль";

  return (
    <div className="relative">
      {/* pr-10 идёт после className вызывающего кода, чтобы текст не заезжал под кнопку. */}
      <input {...inputProps} type={visible ? "text" : "password"} className={clsx(className, "pr-10")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        title={label}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
