import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import QRScanner from "./pages/QRScanner";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/scanner",
    Component: QRScanner,
  },
]);
