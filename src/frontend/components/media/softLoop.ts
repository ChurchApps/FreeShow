export interface SoftLoopParams {
    video: HTMLVideoElement | null;
    softLoopVideo: HTMLVideoElement | null;
    softLoopValue: number;
    actualEndTime: number;
    fromTime: number;
    loop: boolean;
    mirror: boolean;
    paused: boolean;
    onUpdate: (state: { opacity?: number; active?: boolean; videoTime?: number; paused?: boolean }) => void;
}

export class SoftLoopManager {
    private swapping = false;
    private active = false;
    private preSeeked = false;
    private elapsed = 0;
    private lastTime = 0;
    private rafId: any = null;
    private params: SoftLoopParams | null = null;

    public update(p: SoftLoopParams) {
        if (this.active && !this.swapping && p.softLoopVideo && this.params?.paused !== p.paused) {
            p.paused ? p.softLoopVideo.pause() : p.softLoopVideo.play().catch(() => {});
        }
        this.params = p;

        if (!p.video || p.softLoopValue <= 0 || !p.loop || p.mirror || this.swapping) {
            if (this.active && !this.swapping) this.reset();
            return;
        }

        const endTime = p.actualEndTime || p.video.duration || 0;
        const time = p.video.currentTime;

        if (this.active) {
            if (time < endTime - p.softLoopValue - 1 && time < p.fromTime - 1) this.reset();
            return;
        }

        if (time >= endTime - p.softLoopValue && endTime > p.softLoopValue) {
            this.active = true;
            this.elapsed = 0;
            this.lastTime = Date.now();
            this.preSeeked = false;
            if (p.softLoopVideo) {
                p.softLoopVideo.currentTime = p.fromTime;
                if (!p.paused) p.softLoopVideo.play().catch(() => {});
            }
            this.startRaf();
        }
    }

    private startRaf() {
        if (this.rafId) return;
        const loop = () => {
            const p = this.params;
            if (!this.active || this.swapping || !p || !p.video) return this.rafId = null;
            const now = Date.now();
            if (!p.paused) this.elapsed += (now - this.lastTime);
            this.lastTime = now;

            const progress = this.elapsed / (p.softLoopValue * 1000);
            if (progress >= 1) return this.swap(p);

            if (!this.preSeeked && progress >= 0.7) {
                this.preSeeked = true;
                p.video.currentTime = p.softLoopVideo?.currentTime ?? p.fromTime;
            }

            p.onUpdate({ opacity: Math.max(0, Math.min(1, progress)), active: true });
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    public handleEnded(p: SoftLoopParams) {
        this.params = p;
        if (p.softLoopValue > 0 && p.loop && this.active && !this.swapping) {
            this.swap(p);
            return true;
        }
        return false;
    }

    public swap(p: SoftLoopParams) {
        if (this.swapping || !this.active) return;
        this.swapping = true;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;

        const target = p.softLoopVideo?.currentTime ?? p.fromTime;
        if (p.video) {
            p.video.currentTime = target;
            if (!p.paused) p.video.play().catch(() => {});
            const done = () => {
                p.video?.removeEventListener("seeked", done);
                this.active = this.swapping = this.preSeeked = false;
                p.onUpdate({ opacity: 0, active: false, videoTime: target, paused: p.paused });
            };
            p.video.addEventListener("seeked", done, { once: true });
            setTimeout(done, 150);
        } else this.reset();
        p.onUpdate({ videoTime: target, paused: p.paused });
    }

    private reset() {
        this.active = this.swapping = this.preSeeked = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.params?.softLoopVideo?.pause();
        this.params?.onUpdate({ opacity: 0, active: false });
    }
}
