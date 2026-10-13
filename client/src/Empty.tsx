import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

// Estado vazio: um ícone, uma frase que diz o que falta e (quando dá) o primeiro passo.
export function Empty({ icon, children, action }: Props) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  );
}
