import { memo } from "react";

const ScreenHeader = memo(() => (
  <div className="absolute top-0 left-0 right-0 z-[25] flex items-start justify-between px-5 pt-4 sm:px-8 sm:pt-6 pointer-events-none select-none">
    {/* Intentionally empty: mixer screen should have zero external contact links */}
    <div />
    <div />
  </div>
));

ScreenHeader.displayName = "ScreenHeader";
export default ScreenHeader;
