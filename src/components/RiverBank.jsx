import { bankToPath } from "../river/geometry.js";

// Both banks, drawn at the fixed page scale from the top-left corner. The SVG is the
// size of the whole river domain; its box, fixed to the window, clips it, so a bigger
// window shows more of the river and nothing is ever scaled to fit. The line sits
// under the page content: a card reaching into the river covers it.
function RiverBank({ river }) {
  return (
    <div className="river-bank" aria-hidden="true">
      <svg viewBox={`0 0 ${river.width} ${river.height}`} focusable="false">
        <path d={bankToPath(river.left)} vectorEffect="non-scaling-stroke" />
        {river.right && <path d={bankToPath(river.right)} vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

export default RiverBank;
