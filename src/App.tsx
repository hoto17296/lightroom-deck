import { lang, messages, t } from "./i18n.ts";
import { ParamGrid } from "./ParamGrid.tsx";
import diagramUrl from "./public/architecture.drawio.png";
import { useLightroom } from "./useLightroom.ts";

import styles from "./App.module.css";

function Intro() {
  if (lang === "ja") {
    return (
      <article className={styles.intro}>
        <h1>Lightroom Deck</h1>
        <p>デスクトップ版 Adobe Lightroom を操作する Web アプリ</p>
        <img
          className={styles.diagram}
          src={diagramUrl}
          alt="構成図: このコンピューター上で、Web ブラウザ内の Lightroom Deck が WebSocket（ws://localhost:7682）で Lightroom デスクトップ版の外部コントローラー API に接続する"
        />
        <h2>使い方</h2>
        <ol>
          <li>
            Lightroom の「環境設定 &gt;
            インターフェイス」で「外部コントローラーを有効にする」をオンにする
          </li>
          <li>
            右上の「Lightroom と接続」を押し、Lightroom に表示されるダイアログで「ペアリング」を押す
          </li>
          <li>Lightroom 側では写真を選択して「ディティール」モードに切り替える</li>
        </ol>
        <h2>操作方法</h2>
        <ul>
          <li>スライダーにマウスを重ねる、または矢印キーで項目を選択する</li>
          <li>
            マウスホイール、または <kbd>+</kbd> / <kbd>-</kbd> キーで値を増減できる
          </li>
          <li>
            スライダーをダブルクリック、または <kbd>Esc</kbd> キーで初期値に戻る
          </li>
        </ul>
        <h2>免責事項</h2>
        <p className={styles.disclaimer}>
          Lightroom Deck は個人が開発した非公式のツールであり、Adobe Inc.
          とは一切関係がなく、同社による承認・支援・保証を受けたものではありません。 Adobe および
          Lightroom は、米国およびその他の国における Adobe Inc. の登録商標または商標です。
          本ツールの使用によって生じたいかなる損害（写真の編集内容の変更や消失を含む）についても、開発者は責任を負いません。
        </p>
      </article>
    );
  }
  return (
    <article className={styles.intro}>
      <h1>Lightroom Deck</h1>
      <p>A web app for controlling Adobe Lightroom for desktop</p>
      <img
        className={styles.diagram}
        src={diagramUrl}
        alt="Architecture: on your computer, Lightroom Deck in the web browser connects over WebSocket (ws://localhost:7682) to the External Controller API of Lightroom (desktop)"
      />
      <h2>Getting started</h2>
      <ol>
        <li>
          In Lightroom, turn on “Enable external controllers” under Preferences &gt; Interface
        </li>
        <li>
          Click “Connect to Lightroom” at the top right, then click “Pair” in the dialog shown by
          Lightroom
        </li>
        <li>In Lightroom, select a photo and switch to Detail view</li>
      </ol>
      <h2>Controls</h2>
      <ul>
        <li>Hover over a slider, or use the arrow keys, to select it</li>
        <li>
          Use the mouse wheel or the <kbd>+</kbd> / <kbd>-</kbd> keys to change its value
        </li>
        <li>
          Double-click a slider or press <kbd>Esc</kbd> to reset it to its default
        </li>
      </ul>
      <h2>Disclaimer</h2>
      <p className={styles.disclaimer}>
        Lightroom Deck is an unofficial, independently developed tool. It is not affiliated with,
        endorsed, sponsored, or supported by Adobe Inc. Adobe and Lightroom are either registered
        trademarks or trademarks of Adobe Inc. in the United States and/or other countries. The
        developer accepts no liability for any damage arising from the use of this tool, including
        changes to or loss of photo edits.
      </p>
    </article>
  );
}

function App() {
  const { status, error, values, connect, disconnect, setValue, nudge, setDragging } =
    useLightroom();

  const editing = values !== null && Object.values(values).some((v) => typeof v === "number");

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.appName}>{t(messages.appName)}</span>
        {status === "connected" ? (
          <button className={styles.secondary} onClick={disconnect}>
            {t(messages.disconnect)}
          </button>
        ) : (
          <button className={styles.primary} onClick={connect} disabled={status === "connecting"}>
            {t(status === "connecting" ? messages.connecting : messages.connect)}
          </button>
        )}
      </header>

      <main className={styles.main}>
        {error && <p className={styles.error}>{error}</p>}
        {status !== "connected" ? (
          <Intro />
        ) : values === null ? (
          <p className={styles.notice}>{t(messages.loading)}</p>
        ) : !editing ? (
          <p className={styles.notice}>{t(messages.notEditing)}</p>
        ) : (
          <ParamGrid values={values} setValue={setValue} nudge={nudge} setDragging={setDragging} />
        )}
      </main>
    </div>
  );
}

export default App;
