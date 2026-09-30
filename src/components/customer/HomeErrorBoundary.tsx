import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class HomeErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MyTree Home render failed", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-5 text-center">
        <section className="w-full rounded-3xl border border-[#F1D6C0] bg-[#FFF8F1] p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE7D4] text-2xl">🌱</div>
          <h1 className="mt-4 text-lg font-extrabold text-[#173D27]">หน้าแรกโหลดไม่สมบูรณ์</h1>
          <p className="mt-2 text-sm leading-6 text-[#66736A]">ลองโหลดใหม่อีกครั้ง ข้อมูลในตะกร้าของคุณยังอยู่</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-12 w-full rounded-2xl bg-[#EB681B] font-bold text-white">โหลดใหม่</button>
        </section>
      </main>
    );
  }
}
