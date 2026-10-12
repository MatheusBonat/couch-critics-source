import { useId, useState } from "react";
import { Rating, RatingTier, Title } from "@notas-app/gen-shared";
import { titleServiceClient } from "@notas-app/gen-client";
import { CommentField } from "./CommentField";
import { useI18n } from "./i18n";
import {
  errorMessage,
  scoreOfSlider,
  sliderLabel,
  sliderMax,
  sliderMin,
  sliderValueOf,
  tierOfSlider,
} from "./lib";

export interface RatingInput {
  score: number;
  comment: string;
  tier: RatingTier;
  spoiler: boolean;
}

interface FormProps {
  mine: Rating | undefined;
  save: (input: RatingInput) => Promise<void>;
  clear: () => Promise<void>;
  onError: (message: string) => void;
}

const defaultValue = 5;

// Posição de cada número na barra, em %, já considerando que ela começa em -0,5.
const thumb = 16;
const scalePosition = (value: number) =>
  `calc(${thumb / 2}px + (100% - ${thumb}px) * ${(value - sliderMin) / (sliderMax - sliderMin)})`;

// Barra de nota, comentário e botões. Serve para a nota do título e para a de cada episódio.
export function RatingForm({ mine, save, clear, onError }: FormProps) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState(sliderValueOf(mine, defaultValue));
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [spoiler, setSpoiler] = useState(mine?.spoiler ?? false);
  const [busy, setBusy] = useState(false);

  const tier = tierOfSlider(value);
  // Sem comentário, a marca de spoiler não vale.
  const spoilerNow = spoiler && comment.trim() !== "";
  const unchanged =
    mine !== undefined && sliderValueOf(mine, defaultValue) === value && mine.comment === comment.trim() && mine.spoiler === spoilerNow;

  const submit = async () => {
    setBusy(true);
    try {
      await save({ score: scoreOfSlider(value), comment, tier, spoiler: spoilerNow });
    } catch (error) {
      onError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await clear();
      setValue(defaultValue);
      setComment("");
      setSpoiler(false);
    } catch (error) {
      onError(errorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const readoutClass =
    tier === RatingTier.PEAK
      ? "editor-score tier tier-peak"
      : tier === RatingTier.ROCK_BOTTOM
        ? "editor-score tier tier-bottom"
        : "editor-score";

  return (
    <form
      className="editor"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="field">
        <div className="field-head">
          <label htmlFor={`${id}-score`}>{t.yourRating}</label>
          <output htmlFor={`${id}-score`} className={readoutClass}>
            {sliderLabel(value, t)}
          </output>
        </div>
        <input
          id={`${id}-score`}
          className="slider"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={0.5}
          value={value}
          aria-valuetext={sliderLabel(value, t)}
          onChange={(event) => setValue(Number(event.target.value))}
        />
        <div className="slider-scale" aria-hidden="true">
          {[0, 5, 10].map((mark) => (
            <span key={mark} className="slider-mark" style={{ left: scalePosition(mark) }}>
              {mark}
            </span>
          ))}
        </div>
        <div className="slider-ends" aria-hidden="true">
          <span className={tier === RatingTier.ROCK_BOTTOM ? "slider-end slider-end-bottom is-active" : "slider-end slider-end-bottom"}>
            {t.tiers.rockBottom} ({t.tierHintLow})
          </span>
          <span className={tier === RatingTier.PEAK ? "slider-end slider-end-peak is-active" : "slider-end slider-end-peak"}>
            {t.tiers.peak} ({t.tierHintHigh})
          </span>
        </div>
      </div>

      <div className="field">
        <CommentField id={`${id}-comment`} value={comment} onChange={setComment} maxLength={300} />
      </div>

      {comment.trim() !== "" && (
        <label className="check">
          <input type="checkbox" checked={spoiler} onChange={(event) => setSpoiler(event.target.checked)} />
          {t.spoiler.label}
        </label>
      )}

      <div className="actions">
        <button type="submit" className="button-primary" disabled={busy || unchanged}>
          {mine ? t.updateRating : t.saveRating}
        </button>
        {mine && (
          <button type="button" className="button-quiet" disabled={busy} onClick={() => void remove()}>
            {t.removeMyRating}
          </button>
        )}
      </div>
    </form>
  );
}

interface Props {
  title: Title;
  mine: Rating | undefined;
  onSaved: (title: Title) => void;
  onError: (message: string) => void;
}

// Nota do título.
export function RatingEditor({ title, mine, onSaved, onError }: Props) {
  return (
    <RatingForm
      mine={mine}
      onError={onError}
      save={async (input) => {
        const response = await titleServiceClient.rate({ titleId: title.id, ...input });
        if (response.title) onSaved(response.title);
      }}
      clear={async () => {
        const response = await titleServiceClient.clearRating({ titleId: title.id });
        if (response.title) onSaved(response.title);
      }}
    />
  );
}
