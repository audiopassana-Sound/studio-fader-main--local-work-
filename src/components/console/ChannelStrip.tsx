import { memo } from "react";
import Fader from "./Fader";
import VUMeter from "./VUMeter";
import PanKnob from "./PanKnob";
import ConsoleButton from "./ConsoleButton";
import { Upload } from "lucide-react";

interface ChannelStripProps {
  name: string;
  value: number;
  isMuted: boolean;
  isSoloed: boolean;
  pan: number;
  vuLevelSource: () => number;
  showUpload?: boolean;
  isMaster?: boolean;
  motorized?: boolean;
  onFaderChange: (value: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onPanChange: (value: number) => void;
}

const ChannelStrip = memo(({
  name,
  value,
  isMuted,
  isSoloed,
  pan,
  vuLevelSource,
  showUpload,
  isMaster,
  motorized,
  onFaderChange,
  onMuteToggle,
  onSoloToggle,
  onPanChange,
}: ChannelStripProps) => {
  const borderClass = isMaster ? "border-primary/30" : "";

  return (
    <div className={`console-strip flex flex-col items-center gap-2 px-3 py-3 rounded ${borderClass}`}
    >
      <div className="flex items-center gap-1">
        <span className={`text-led font-bold ${isMaster ? "text-primary" : "text-foreground"}`}>
          {name}
        </span>
        {showUpload && <Upload className="w-2.5 h-2.5 text-muted-foreground" />}
      </div>

      {isMaster ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-led text-muted-foreground opacity-0">PAN</span>
          <div className="w-7 h-7" />
          <span className="text-led text-muted-foreground/60 text-[0.5rem] opacity-0">C</span>
        </div>
      ) : (
        <PanKnob value={pan} onChange={onPanChange} />
      )}

      <div className="flex gap-1.5">
        <ConsoleButton label="M" active={isMuted} variant="mute" onClick={onMuteToggle} />
        <ConsoleButton label="S" active={isSoloed} variant="solo" onClick={onSoloToggle} />
      </div>

      <div className="flex items-stretch gap-1.5">
        <VUMeter levelSource={vuLevelSource} />
        <Fader value={value} onChange={onFaderChange} motorized={motorized} />
        <VUMeter levelSource={vuLevelSource} />
      </div>

      <div className="text-led text-primary tabular-nums">
        {value === 0 ? "-∞" : `${((value / 100) * 12 - 12).toFixed(1)}`}
        <span className="text-muted-foreground ml-0.5">dB</span>
      </div>
    </div>
  );
});

ChannelStrip.displayName = "ChannelStrip";
export default ChannelStrip;
