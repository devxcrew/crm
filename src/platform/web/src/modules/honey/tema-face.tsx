export function TemaFace({ size = "message" }: { size?: "header" | "message" | "welcome" }) {
  const frame = size === "header" ? "size-12" : size === "welcome" ? "size-16" : "size-10";
  const sprite = size === "welcome" ? "scale-[0.58]" : size === "header" ? "scale-[0.5]" : "scale-[0.42]";
  return (
    <span
      aria-label="TEMA mascot"
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-violet-100/70 ${frame}`}
      role="img"
    >
      <span
        className={`absolute left-1/2 top-1/2 block h-[121px] w-[111px] -translate-x-1/2 -translate-y-[47%] bg-[url('/pets/tema/spritesheet.webp')] bg-no-repeat ${sprite}`}
      />
    </span>
  );
}
