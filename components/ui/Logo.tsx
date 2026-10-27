/* eslint-disable @next/next/no-img-element */
/** The SurveyMonkey monkey on its green-to-yellow tile. Decorative: the app name always sits beside it. */
export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={size > 64 ? "/brand/monkey-512.png" : "/brand/monkey-128.png"}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] ${className}`}
    />
  );
}
