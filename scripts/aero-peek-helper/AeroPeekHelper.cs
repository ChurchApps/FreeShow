using System;
using System.Runtime.InteropServices;

namespace AeroPeekHelper {
    class Program {
        [DllImport("dwmapi.dll", PreserveSig = true)]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int val, int size);

        static void Main(string[] args) {
            if (args.Length < 2) {
                Console.WriteLine("Usage: AeroPeekHelper.exe <hwnd> <enabled_0_or_1>");
                return;
            }

            long hwndVal;
            if (!long.TryParse(args[0], out hwndVal)) {
                Console.WriteLine("Invalid HWND");
                return;
            }
            IntPtr hwnd = new IntPtr(hwndVal);

            int enabled;
            if (!int.TryParse(args[1], out enabled)) {
                Console.WriteLine("Invalid state");
                return;
            }

            int val = enabled;
            // DWMWA_EXCLUDED_FROM_PEEK has value 11 or 12 depending on the OS version.
            // Setting both ensures compatibility across Windows versions.
            DwmSetWindowAttribute(hwnd, 11, ref val, sizeof(int));
            DwmSetWindowAttribute(hwnd, 12, ref val, sizeof(int));
        }
    }
}
