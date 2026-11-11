import { useEffect, useRef, useState } from "react";
import { CollapseIcon, ExpandIcon, PipIcon } from "@/components/icons";

interface VideoPlayerProps {
  src: string;
  title: string;
  autoPlay?: boolean;
}

/**
 * A video player with native controls plus explicit full-screen and
 * picture-in-picture buttons. PiP is feature-detected and hidden in
 * browsers that don't support it (e.g. Firefox for most video, some mobile
 * browsers); full-screen falls back gracefully if the API is unavailable.
 */
export function VideoPlayer({ src, title, autoPlay }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        document.pictureInPictureEnabled &&
        typeof HTMLVideoElement !== "undefined" &&
        "requestPictureInPicture" in HTMLVideoElement.prototype,
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPip(true);
    const onLeave = () => setIsPip(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === videoRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else {
        // Safari iOS fallback.
        type WebkitVideo = HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
        };
        (video as WebkitVideo).webkitEnterFullscreen?.();
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
    }
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("Picture-in-picture request failed", err);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration)
      ? video.duration
      : Infinity;
    video.currentTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      duration,
    );
  };

  return (
    <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="truncate text-sm font-medium text-white/90">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          {pipSupported && (
            <button
              type="button"
              onClick={togglePip}
              aria-pressed={isPip}
              title={isPip ? "Exit picture-in-picture" : "Picture-in-picture"}
              className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <PipIcon className="size-4" />
              <span className="hidden sm:inline">
                {isPip ? "Exit PiP" : "PiP"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {isFullscreen ? (
              <CollapseIcon className="size-4" />
            ) : (
              <ExpandIcon className="size-4" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Exit" : "Full screen"}
            </span>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-white/10 px-4 py-2">
        <button
          type="button"
          onClick={() => skip(-30)}
          title="Back 30 seconds"
          className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          −30s
        </button>
        <button
          type="button"
          onClick={() => skip(-10)}
          title="Back 10 seconds"
          className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          −10s
        </button>
        <button
          type="button"
          onClick={() => skip(10)}
          title="Forward 10 seconds"
          className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          +10s
        </button>
        <button
          type="button"
          onClick={() => skip(30)}
          title="Forward 30 seconds"
          className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          +30s
        </button>
      </div>
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay={autoPlay}
        playsInline
        className="max-h-[75vh] w-full bg-black"
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
