import type { RoomKey, RoomLightingState } from "@/domain/smartHomeTypes";

type ApartmentLightingSvgProps = {
  roomLighting: Record<RoomKey, RoomLightingState>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roomOpacity = (on: boolean, brightness: number) => {
  if (!on) return 0;
  const normalized = clamp(brightness / 100, 0, 1);
  return 0.05 + Math.pow(normalized, 1.65) * 0.34;
};

export function ApartmentLightingSvg({ roomLighting }: ApartmentLightingSvgProps) {
  const bedroomOpacity = roomOpacity(roomLighting.bedroom.on, roomLighting.bedroom.brightness);
  const livingOpacity = roomOpacity(roomLighting.living.on, roomLighting.living.brightness);
  const kitchenOpacity = roomOpacity(roomLighting.kitchen.on, roomLighting.kitchen.brightness);
  const diningOpacity = roomOpacity(roomLighting.dining.on, roomLighting.dining.brightness);

  return (
    <svg
      aria-hidden="true"
      className="apartment-light-svg"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 1448 1086"
    >
      <defs>
        <radialGradient id="roomWarmCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,239,201,0.96)" />
          <stop offset="35%" stopColor="rgba(255,225,160,0.78)" />
          <stop offset="70%" stopColor="rgba(255,210,138,0.32)" />
          <stop offset="100%" stopColor="rgba(255,210,138,0)" />
        </radialGradient>
        <radialGradient id="roomWarmSoft" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,246,224,0.70)" />
          <stop offset="62%" stopColor="rgba(255,225,171,0.24)" />
          <stop offset="100%" stopColor="rgba(255,225,171,0)" />
        </radialGradient>
        <linearGradient id="kitchenStripGlow" x1="0%" x2="100%" y1="50%" y2="50%">
          <stop offset="0%" stopColor="rgba(255,233,180,0)" />
          <stop offset="18%" stopColor="rgba(255,233,180,0.30)" />
          <stop offset="50%" stopColor="rgba(255,239,201,0.88)" />
          <stop offset="82%" stopColor="rgba(255,233,180,0.30)" />
          <stop offset="100%" stopColor="rgba(255,233,180,0)" />
        </linearGradient>
        <filter id="lightBlurSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="lightBlurWide" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
        <clipPath id="clip-bedroom">
          <polygon points="90,315 460,228 635,420 538,630 244,665 112,535" />
        </clipPath>
        <clipPath id="clip-living">
          <polygon points="420,520 923,470 1158,760 803,1002 450,930 308,748" />
        </clipPath>
        <clipPath id="clip-kitchen">
          <polygon points="560,92 1102,94 1034,395 680,425 560,296" />
        </clipPath>
        <clipPath id="clip-dining">
          <polygon points="938,320 1328,286 1394,632 1102,710 918,540" />
        </clipPath>
      </defs>

      <g clipPath="url(#clip-bedroom)" opacity={bedroomOpacity}>
        <ellipse cx="375" cy="462" fill="url(#roomWarmCore)" filter="url(#lightBlurWide)" rx="292" ry="210" />
        <ellipse cx="315" cy="346" fill="url(#roomWarmCore)" filter="url(#lightBlurSoft)" rx="86" ry="72" />
        <ellipse cx="468" cy="338" fill="url(#roomWarmCore)" filter="url(#lightBlurSoft)" rx="74" ry="64" />
        <ellipse cx="384" cy="425" fill="url(#roomWarmSoft)" filter="url(#lightBlurWide)" rx="190" ry="120" />
      </g>

      <g clipPath="url(#clip-living)" opacity={livingOpacity}>
        <ellipse cx="694" cy="756" fill="url(#roomWarmCore)" filter="url(#lightBlurWide)" rx="312" ry="228" />
        <ellipse cx="634" cy="710" fill="url(#roomWarmSoft)" filter="url(#lightBlurWide)" rx="168" ry="110" />
        <ellipse cx="878" cy="934" fill="url(#roomWarmCore)" filter="url(#lightBlurSoft)" rx="62" ry="58" />
      </g>

      <g clipPath="url(#clip-kitchen)" opacity={kitchenOpacity}>
        <rect x="636" y="210" width="400" height="24" rx="12" fill="url(#kitchenStripGlow)" filter="url(#lightBlurSoft)" />
        <ellipse cx="792" cy="334" fill="url(#roomWarmSoft)" filter="url(#lightBlurWide)" rx="228" ry="108" />
        <ellipse cx="820" cy="277" fill="url(#roomWarmCore)" filter="url(#lightBlurSoft)" rx="118" ry="72" />
      </g>

      <g clipPath="url(#clip-dining)" opacity={diningOpacity}>
        <ellipse cx="1120" cy="486" fill="url(#roomWarmCore)" filter="url(#lightBlurWide)" rx="192" ry="154" />
        <ellipse cx="1108" cy="450" fill="url(#roomWarmSoft)" filter="url(#lightBlurSoft)" rx="98" ry="84" />
      </g>
    </svg>
  );
}
