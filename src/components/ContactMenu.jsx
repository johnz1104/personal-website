import { useEffect, useId, useRef, useState } from "react";
import contact from "../data/contact.js";
import { PAGE_SCALE } from "../river/sim/config.js";

// The menu's lowest point, in page units from the top of the river. The bank turns left
// toward the bottom of the window, so in windows taller than about 16:10 the open panel
// crossed it (1440 x 900 and 1280 x 1000, measured 2026-10-05); there the menu rises to
// stay on land. Common laptop windows (up to 1728 x 990) keep it at the bottom.
const LOWEST = 960;

// 16 x 16 icons from GitHub's Octicons (MIT licence): mail, mark-github, copy, check
// and link-external ("open").
const ICONS = {
  mail: [
    "M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2ZM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.809L8.38 9.397a.75.75 0 0 1-.76 0L1.5 5.809v6.442Zm13-8.181v-.32a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25v.32L8 7.88Z",
  ],
  github: [
    "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z",
  ],
  copy: [
    "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z",
    "M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z",
  ],
  check: [
    "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z",
  ],
  open: [
    "M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z",
  ],
};

function Icon({ name }) {
  return (
    <svg className="contact-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// "Contact" at the bottom left of the window (RiverLayout shows it on the pages that
// share the home river). Clicking it opens the email address and GitHub above it;
// clicking it again, clicking elsewhere or pressing Escape closes them. The email
// opens in the default mail program in the same tab: a new tab would stay empty when
// that program is a desktop app. `viewBottom`: the window's bottom in page units
// (windowView in config.js); RiverLayout re-renders this on every resize.
function ContactMenu({ viewBottom }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef(null);
  const toggle = useRef(null);
  const address = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!root.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (root.current.contains(document.activeElement)) toggle.current.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The copy icon shows a check mark for a moment after copying.
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
    } catch {
      // No clipboard (a page served without HTTPS, or a refused permission): select
      // the address so it can be copied by hand.
      getSelection().selectAllChildren(address.current);
    }
  }

  return (
    <div
      className="contact"
      ref={root}
      // Inside the zoomed page content, so one page unit is PAGE_SCALE px here.
      style={{ bottom: `max(1.5rem, ${(viewBottom - LOWEST) * PAGE_SCALE}px)` }}
    >
      <ul className="contact-panel" id={panelId} hidden={!open}>
        <li>
          <Icon name="mail" />
          <span ref={address}>{contact.email}</span>
          <button
            type="button"
            className="contact-action"
            aria-label="Copy email address"
            title="Copy email address"
            onClick={copyEmail}
          >
            <Icon name={copied ? "check" : "copy"} />
          </button>
          <a
            className="contact-action"
            href={`mailto:${contact.email}`}
            aria-label="Write an email"
            title="Write an email"
          >
            <Icon name="open" />
          </a>
          <span className="visually-hidden" role="status">
            {copied ? "Copied" : ""}
          </span>
        </li>
        <li>
          <Icon name="github" />
          <span>{contact.github.replace(/^https:\/\//, "")}</span>
          <a
            className="contact-action"
            href={contact.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open GitHub in a new tab"
            title="Open GitHub in a new tab"
          >
            <Icon name="open" />
          </a>
        </li>
      </ul>
      <button
        type="button"
        ref={toggle}
        className="contact-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((shown) => !shown)}
      >
        Contact
      </button>
    </div>
  );
}

export default ContactMenu;
