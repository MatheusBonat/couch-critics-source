import { IconClose } from "./icons";

interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Botão de fechar dos painéis: só o ícone, com o nome para leitores de tela e para o balão do mouse.
export function CloseButton({ label, onClick, disabled }: Props) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <IconClose />
    </button>
  );
}
