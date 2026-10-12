import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}

type GroupKey = "faces" | "hands" | "media" | "symbols";

// Emojis comuns para comentar filmes, séries e jogos. Só emojis simples (sem sequências combinadas),
// que aparecem igual em qualquer sistema.
const groups: { key: GroupKey; emojis: string[] }[] = [
  { key: "faces", emojis: ["😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "🥳", "😭", "😱", "🤯", "😴", "🤔", "😬", "🙄", "😡", "🤮", "💀"] },
  { key: "hands", emojis: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "❤️", "💔", "🔥", "✨", "💯"] },
  { key: "media", emojis: ["🎬", "🍿", "📺", "🎮", "🕹️", "🎧", "🎭", "🎞️", "🎥", "🏆", "⭐", "🌟", "💎", "🐐", "🗑️", "💩"] },
  { key: "symbols", emojis: ["✅", "❌", "⚠️", "💤", "💥", "🎉", "🥱", "🧠", "👀", "🤌"] },
];

// Campo de comentário com um botão que abre a lista de emojis e coloca o escolhido onde está o cursor.
export function CommentField({ id, value, onChange, maxLength }: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  // Clicar fora fecha a lista.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const insert = (emoji: string) => {
    const area = areaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);

    // O limite conta unidades do texto, e alguns emojis ocupam duas.
    if (next.length > maxLength) return;

    onChange(next);
    requestAnimationFrame(() => {
      area?.focus();
      const caret = start + emoji.length;
      area?.setSelectionRange(caret, caret);
    });
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="comment-field" ref={wrapRef}>
      <div className="comment-head">
        <label htmlFor={id}>{t.commentOptional}</label>
        <button
          ref={buttonRef}
          type="button"
          className="button-quiet emoji-toggle"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span aria-hidden="true">😊</span> {t.emoji.open}
        </button>
      </div>

      <textarea
        id={id}
        ref={areaRef}
        className="input"
        rows={2}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {value.length >= maxLength - 60 && (
        <span className="comment-count" aria-live="polite">
          {value.length}/{maxLength}
        </span>
      )}

      {open && (
        <div
          className="emoji-popover"
          role="dialog"
          aria-label={t.emoji.title}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          {groups.map((group) => (
            <div key={group.key} className="emoji-group">
              <p className="emoji-group-title">{t.emoji.groups[group.key]}</p>
              <div className="emoji-grid" role="group" aria-label={t.emoji.groups[group.key]}>
                {group.emojis.map((emoji) => (
                  <button key={emoji} type="button" className="emoji" aria-label={emoji} onClick={() => insert(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
