import { useCallback, useRef, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";

const INTRO_CUT_SECONDS = 2.0;

const Intro = () => {
  const navigate = useNavigate();
  const didNavigateRef = useRef(false);

  const goToTheStage = useCallback(() => {
    if (didNavigateRef.current) return;
    didNavigateRef.current = true;
    navigate("/", { replace: true });
  }, [navigate]);

  const handleTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (didNavigateRef.current) return;
      const t = event.currentTarget.currentTime;
      if (Number.isFinite(t) && t >= INTRO_CUT_SECONDS) {
        goToTheStage();
      }
    },
    [goToTheStage]
  );

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <video
        src="/logo-intro.mp4"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={goToTheStage}
      />
    </div>
  );
};

export default Intro;
