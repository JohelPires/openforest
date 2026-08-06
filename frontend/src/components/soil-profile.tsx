interface SoilProfileProps {
  className?: string;
}

export function SoilProfile({ className }: SoilProfileProps) {
  return (
    <div
      className={`soil-gradient relative overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,150 C90,141 180,158 270,150 C360,142 450,157 540,148 C570,145 590,147 600,146 L600,209 C540,204 420,213 320,207 C210,200 100,212 0,205 Z"
          fill="rgba(181,201,176,0.1)"
        />
        <path
          d="M0,205 C100,212 210,200 320,207 C420,213 510,204 600,209 L600,362 C540,370 450,356 360,364 C250,372 130,356 0,365 Z"
          fill="rgba(181,201,176,0.055)"
        />
        <path
          d="M0,365 C120,356 230,372 340,364 C450,356 540,370 600,362 L600,566 C560,562 470,573 360,567 C250,560 130,572 0,565 Z"
          fill="rgba(181,201,176,0.045)"
        />
        <path
          d="M0,565 C130,572 250,560 360,567 C470,573 560,562 600,566 L600,794 C570,796 520,788 450,792 C300,800 150,790 0,800 Z"
          fill="rgba(181,201,176,0.035)"
        />

        <path
          d="M0,205 C100,212 210,200 320,207 C420,213 510,204 600,209"
          fill="none"
          stroke="rgba(181,201,176,0.3)"
          strokeWidth="1"
        />
        <path
          d="M0,365 C120,356 230,372 340,364 C450,356 540,370 600,362"
          fill="none"
          stroke="rgba(181,201,176,0.3)"
          strokeWidth="1"
        />
        <path
          d="M0,565 C130,572 250,560 360,567 C470,573 560,562 600,566"
          fill="none"
          stroke="rgba(181,201,176,0.3)"
          strokeWidth="1"
        />
        <path
          d="M0,800 C150,790 300,800 450,792 C520,788 570,796 600,794"
          fill="none"
          stroke="rgba(181,201,176,0.2)"
          strokeWidth="1"
        />
        <path
          d="M0,150 C90,141 180,158 270,150 C360,142 450,157 540,148 C570,145 590,147 600,146"
          fill="none"
          stroke="rgba(196,167,108,0.55)"
          strokeWidth="1.25"
          strokeDasharray="6 6"
        />

        <g fill="rgba(196,167,108,0.9)">
          <path d="M300,150 C300,146 300,144 300,141 M300,144 C295,142 292,138 291,133 C296,134 300,139 300,144 M300,144 C305,142 308,138 309,133 C304,134 300,139 300,144" />
          <path
            d="M252,152 C252,149 252,148 252,146 M252,148 C249,147 247,144 246,141 C250,142 252,145 252,148 M252,148 C255,147 257,144 258,141 C254,142 252,145 252,148"
            opacity="0.7"
          />
          <path
            d="M366,149 C366,146 366,144 366,142 M366,145 C363,144 361,141 360,138 C364,139 366,142 366,145 M366,145 C369,144 371,141 372,138 C368,139 366,142 366,145"
            opacity="0.5"
          />
          <path
            d="M178,153 C178,150 178,149 178,147 M178,150 C176,149 174,146 173,144 C176,144 178,147 178,150 M178,150 C180,149 182,146 183,144 C180,144 178,147 178,150"
            opacity="0.35"
          />
        </g>

        <path
          className="root-path"
          d="M300,150 C300,230 292,310 300,390 C306,460 294,520 300,585"
          fill="none"
          stroke="rgba(181,201,176,0.75)"
          strokeWidth="1.5"
          strokeDasharray="400"
          strokeDashoffset="400"
        />
        <path
          className="root-path-delay-1"
          d="M296,240 C230,248 170,268 122,298"
          fill="none"
          stroke="rgba(181,201,176,0.6)"
          strokeWidth="1"
          strokeDasharray="400"
          strokeDashoffset="400"
        />
        <path
          className="root-path-delay-2"
          d="M302,255 C370,262 428,282 476,308"
          fill="none"
          stroke="rgba(181,201,176,0.6)"
          strokeWidth="1"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <path
          className="root-path-delay-3"
          d="M297,360 C235,372 178,408 137,452"
          fill="none"
          stroke="rgba(181,201,176,0.55)"
          strokeWidth="1"
          strokeDasharray="350"
          strokeDashoffset="350"
        />
        <path
          className="root-path-delay-4"
          d="M301,370 C365,385 422,423 466,457"
          fill="none"
          stroke="rgba(181,201,176,0.55)"
          strokeWidth="1"
          strokeDasharray="250"
          strokeDashoffset="250"
        />
        <path
          className="root-path-delay-5"
          d="M299,470 C330,520 358,568 382,616"
          fill="none"
          stroke="rgba(181,201,176,0.5)"
          strokeWidth="0.9"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <path
          className="root-path-delay-1"
          d="M252,215 C230,238 208,268 197,303"
          fill="none"
          stroke="rgba(181,201,176,0.5)"
          strokeWidth="0.7"
          strokeDasharray="400"
          strokeDashoffset="400"
        />
        <path
          className="root-path-delay-2"
          d="M352,222 C374,248 398,282 412,318"
          fill="none"
          stroke="rgba(181,201,176,0.5)"
          strokeWidth="0.7"
          strokeDasharray="300"
          strokeDashoffset="300"
        />
        <path
          className="root-path-delay-3"
          d="M301,440 C276,485 246,540 226,598"
          fill="none"
          stroke="rgba(181,201,176,0.5)"
          strokeWidth="0.7"
          strokeDasharray="350"
          strokeDashoffset="350"
        />

        <g fill="rgba(196,167,108,0.9)">
          <circle className="soil-node" cx="122" cy="298" r="3" />
          <circle className="soil-node soil-node-delay-1" cx="476" cy="308" r="3" />
          <circle className="soil-node soil-node-delay-2" cx="137" cy="452" r="3" />
          <circle className="soil-node soil-node-delay-1" cx="466" cy="457" r="3" />
          <circle className="soil-node soil-node-delay-3" cx="300" cy="585" r="3.5" />
          <circle className="soil-node soil-node-delay-2" cx="382" cy="616" r="3" />
          <circle className="soil-node soil-node-delay-4" cx="197" cy="303" r="2.5" />
          <circle className="soil-node soil-node-delay-3" cx="226" cy="598" r="2.5" />
        </g>

        <g stroke="rgba(196,167,108,0.25)" fill="rgba(196,167,108,0.08)">
          <path d="M90,680 L150,660 L210,700 L130,730 Z" />
          <path d="M320,640 L400,660 L380,720 L300,700 Z" />
          <path d="M480,720 L540,700 L590,750 L520,780 Z" />
        </g>

        <text
          className="font-mono"
          x="28"
          y="40"
          fill="rgba(181,201,176,0.7)"
          fontSize="9"
          style={{ letterSpacing: "0.18em" }}
        >
          PERFIL DE SOLO
        </text>

        <g textAnchor="end" className="font-mono">
          <text
            x="585"
            y="186"
            fill="rgba(196,167,108,0.9)"
            fontSize="11"
            style={{ letterSpacing: "0.12em" }}
          >
            FOLHIÇO
          </text>
          <text
            x="585"
            y="199"
            fill="rgba(181,201,176,0.75)"
            fontSize="9"
            style={{ letterSpacing: "0.08em" }}
          >
            MATÉRIA ORGÂNICA
          </text>
          <text
            x="585"
            y="302"
            fill="rgba(196,167,108,0.9)"
            fontSize="11"
            style={{ letterSpacing: "0.12em" }}
          >
            HORIZONTE A
          </text>
          <text
            x="585"
            y="315"
            fill="rgba(181,201,176,0.75)"
            fontSize="9"
            style={{ letterSpacing: "0.08em" }}
          >
            HÚMUS
          </text>
          <text
            x="585"
            y="500"
            fill="rgba(196,167,108,0.9)"
            fontSize="11"
            style={{ letterSpacing: "0.12em" }}
          >
            HORIZONTE B
          </text>
          <text
            x="585"
            y="513"
            fill="rgba(181,201,176,0.75)"
            fontSize="9"
            style={{ letterSpacing: "0.08em" }}
          >
            ARGILA
          </text>
          <text
            x="585"
            y="690"
            fill="rgba(196,167,108,0.9)"
            fontSize="11"
            style={{ letterSpacing: "0.12em" }}
          >
            HORIZONTE C
          </text>
          <text
            x="585"
            y="703"
            fill="rgba(181,201,176,0.75)"
            fontSize="9"
            style={{ letterSpacing: "0.08em" }}
          >
            ROCHA · SAPROLITO
          </text>
        </g>
      </svg>
    </div>
  );
}
