import '../styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

export default function MyApp({ Component, pageProps }) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-gradient-to-r from-purple-950 via-indigo-950 to-neutral-900 p-3 sm:p-5">
      <span className="text-white font-mono text-xl font-bold">igorizviekov</span>
      <Component {...pageProps} />
      <ToastContainer />
    </div>
  );
}
