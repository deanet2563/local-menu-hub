import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class FoodHubErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FoodHub render error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F7F8F3] px-4 py-8 text-[#183B27]">
        <div className="mx-auto max-w-lg rounded-3xl border border-[#F2CDAF] bg-[#FFF5EC] p-5">
          <h1 className="text-lg font-black text-[#79340F]">Food Hub แสดงผลไม่สำเร็จ</h1>
          <p className="mt-2 text-sm leading-6 text-[#89583C]">
            ข้อมูลร้านยังไม่หาย คุณสามารถลองโหลดหน้านี้ใหม่ได้
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-11 rounded-xl bg-[#EB681B] px-5 text-sm font-bold text-white"
          >
            โหลดอีกครั้ง
          </button>
        </div>
      </div>
    );
  }
}
