interface HorizonLineProps {
  className?: string;
}

export function HorizonLine({ className }: HorizonLineProps) {
  return (
    <svg
      viewBox="0 0 1440 24"
      preserveAspectRatio="none"
      className={`block h-3 w-full ${className ?? ""}`}
      aria-hidden="true"
    >
      <path
        d="M0,12 C45,6 90,18 135,12 C180,6 225,18 270,12 C315,6 360,18 405,12 C450,6 495,18 540,12 C585,6 630,18 675,12 C720,6 765,18 810,12 C855,6 900,18 945,12 C990,6 1035,18 1080,12 C1125,6 1170,18 1215,12 C1260,6 1305,18 1350,12 C1395,6 1440,18 1440,12"
        fill="none"
        stroke="rgba(181,201,176,0.55)"
        strokeWidth="1"
      />
    </svg>
  );
}
