import { useI18n } from "./i18n";
import { CloseButton } from "./CloseButton";
import tmdbLogo from "./assets/tmdb-logo.svg";

interface Props {
  onClose: () => void;
}

// Créditos exigidos pelas fontes de dados. O aviso do TMDB precisa ficar em inglês, do jeito que eles pedem.
export function AboutPanel({ onClose }: Props) {
  const { t } = useI18n();

  return (
    <section
      className="panel about"
      aria-labelledby="about-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="panel-bar">
        <h2 id="about-title" className="panel-title">
          {t.about.title}
        </h2>
        <CloseButton label={t.about.close} onClick={onClose} />
      </div>

      <p className="muted">{t.about.intro}</p>

      <div className="credit">
        <img className="credit-logo" src={tmdbLogo} alt="TMDB" width={220} />
        <p lang="en">{t.about.tmdbNotice}</p>
        <p className="muted">{t.about.tmdbDetail}</p>
      </div>

      <div className="credit">
        <p>{t.about.imdbNotice}</p>
      </div>

      <div className="credit">
        <p>{t.about.igdbNotice}</p>
      </div>

      <div className="credit">
        <p>{t.about.openLibraryNotice}</p>
        <p>{t.about.aniListNotice}</p>
        <p>{t.about.musicBrainzNotice}</p>
      </div>

      <div className="credit">
        <p>{t.about.independent}</p>
        <p>{t.about.rules}</p>
        <p>
          <a href={t.about.termsUrl} target="_blank" rel="noopener noreferrer">
            {t.about.termsLink}
          </a>
          {" · "}
          <a href={t.about.guidelinesUrl} target="_blank" rel="noopener noreferrer">
            {t.about.guidelinesLink}
          </a>
        </p>
      </div>

      <div className="credit">
        <p>{t.about.privacy}</p>
        <p>
          <a href={t.about.privacyUrl} target="_blank" rel="noopener noreferrer">
            {t.about.privacyLink}
          </a>
        </p>
      </div>
    </section>
  );
}
