import { render } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";

jest.mock("@/store/appStore", () => ({ useAppStore: (selector: (state: { themeMode: string }) => unknown) => selector({ themeMode: "light" }) }));

describe("StatusPill", () => {
  it("announces the sync state to assistive technology", async () => {
    const view = await render(<StatusPill status="queued" />);
    expect(view.getByLabelText("Trạng thái: Đang chờ")).toBeTruthy();
  });
});
