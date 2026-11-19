using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Windows does not allow reading keyboard devices (most presentation clickers) as HID devices,
// so this reads them through Raw Input instead, which also works when FreeShow is not focused.
// Only devices FreeShow listens to are reported, key presses still reach the focused app.
//
// Input (stdin):   "+<device id>" to listen to a device, "-<device id>" to stop listening
//                  closing stdin (FreeShow stopped listening or closed) exits the helper
// Output (stdout): "<device name>\t<virtual key>\t<scan code>\t<flags>" for each key press

namespace HidInputHelper {
    class Program {
        const int WM_INPUT = 0x00FF;
        const int RIDEV_INPUTSINK = 0x00000100;
        const uint RID_INPUT = 0x10000003;
        const uint RIM_TYPEKEYBOARD = 1;
        const uint RIDI_DEVICENAME = 0x20000007;
        const int RI_KEY_BREAK = 0x01;
        const int RI_KEY_E0 = 0x02;
        const int RI_KEY_E1 = 0x04;

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTDEVICE {
            public ushort usUsagePage;
            public ushort usUsage;
            public int dwFlags;
            public IntPtr hwndTarget;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWINPUTHEADER {
            public uint dwType;
            public uint dwSize;
            public IntPtr hDevice;
            public IntPtr wParam;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct RAWKEYBOARD {
            public ushort MakeCode;
            public ushort Flags;
            public ushort Reserved;
            public ushort VKey;
            public uint Message;
            public uint ExtraInformation;
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);

        [DllImport("user32.dll")]
        static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);

        [DllImport("user32.dll", EntryPoint = "GetRawInputDeviceInfoW", CharSet = CharSet.Unicode)]
        static extern uint GetRawInputDeviceInfo(IntPtr hDevice, uint uiCommand, IntPtr pData, ref uint pcbSize);

        static readonly object watchedLock = new object();
        static readonly HashSet<string> watched = new HashSet<string>();
        static readonly Dictionary<string, long> pressedTicks = new Dictionary<string, long>();

        [STAThread]
        static void Main(string[] args) {
            try {
                InputWindow window = new InputWindow();

                RAWINPUTDEVICE[] devices = new RAWINPUTDEVICE[1];
                devices[0].usUsagePage = 0x01; // generic desktop
                devices[0].usUsage = 0x06; // keyboard
                devices[0].dwFlags = RIDEV_INPUTSINK; // also receive input when not in the foreground
                devices[0].hwndTarget = window.Handle;

                if (!RegisterRawInputDevices(devices, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)))) {
                    Console.Error.WriteLine("Could not register for Raw Input, error " + Marshal.GetLastWin32Error());
                    Environment.Exit(1);
                }

                Thread commands = new Thread(ReadCommands);
                commands.IsBackground = true;
                commands.Start();

                Application.Run();
            } catch (Exception ex) {
                Console.Error.WriteLine("Helper Main exception: " + ex);
            }
        }

        // hidden window that receives the WM_INPUT messages
        class InputWindow : NativeWindow {
            public InputWindow() {
                CreateHandle(new CreateParams());
            }

            protected override void WndProc(ref Message m) {
                try {
                    if (m.Msg == WM_INPUT) ReadInput(m.LParam);
                } catch (Exception ex) {
                    Console.Error.WriteLine("WndProc exception: " + ex);
                }
                base.WndProc(ref m);
            }
        }

        static void ReadCommands() {
            try {
                string line;
                while ((line = Console.In.ReadLine()) != null) {
                    line = line.Trim();
                    if (line.Length < 2) continue;

                    string id = line.Substring(1);
                    lock (watchedLock) {
                        if (line[0] == '+') watched.Add(id);
                        else if (line[0] == '-') watched.Remove(id);
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("ReadCommands exception: " + ex);
            }

            Environment.Exit(0);
        }

        static void ReadInput(IntPtr rawInput) {
            uint headerSize = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
            uint size = 0;
            GetRawInputData(rawInput, RID_INPUT, IntPtr.Zero, ref size, headerSize);
            if (size == 0) return;

            IntPtr buffer = Marshal.AllocHGlobal((int)size);
            try {
                if (GetRawInputData(rawInput, RID_INPUT, buffer, ref size, headerSize) != size) return;

                RAWINPUTHEADER header = (RAWINPUTHEADER)Marshal.PtrToStructure(buffer, typeof(RAWINPUTHEADER));
                if (header.dwType != RIM_TYPEKEYBOARD) return;

                RAWKEYBOARD keyboard = (RAWKEYBOARD)Marshal.PtrToStructure(IntPtr.Add(buffer, (int)headerSize), typeof(RAWKEYBOARD));

                // input from SendInput has no device
                string name = GetDeviceName(header.hDevice);
                if (string.IsNullOrEmpty(name)) return;

                string id = GetDeviceId(name);
                lock (watchedLock) {
                    if (!watched.Contains(id)) return;
                }

                int flags = keyboard.Flags & (RI_KEY_E0 | RI_KEY_E1);
                string key = id + "|" + keyboard.VKey + "|" + keyboard.MakeCode + "|" + flags;
                long now = Environment.TickCount;

                if ((keyboard.Flags & RI_KEY_BREAK) != 0) {
                    lock (pressedTicks) {
                        pressedTicks.Remove(key);
                    }
                    return;
                }

                lock (pressedTicks) {
                    long lastPress;
                    if (pressedTicks.TryGetValue(key, out lastPress)) {
                        // Environment.TickCount wraps every ~24.9 days, handled by uint difference.
                        // While the button is held down, auto-repeat events arrive rapidly (typically every 30-50ms).
                        // If less than 1500ms since the last repeat pulse, update timestamp and suppress re-trigger.
                        // If more than 1500ms passed without ANY event, the user has released and clicked again,
                        // even on clickers that drop the RI_KEY_BREAK event.
                        if ((uint)(now - lastPress) < 1500) {
                            pressedTicks[key] = now;
                            return;
                        }
                    }
                    pressedTicks[key] = now;
                }

                Console.Out.WriteLine(name + "\t" + keyboard.VKey + "\t" + keyboard.MakeCode + "\t" + flags);
                Console.Out.Flush();
            } finally {
                Marshal.FreeHGlobal(buffer);
            }
        }

        static string GetDeviceName(IntPtr device) {
            if (device == IntPtr.Zero) return "";

            uint size = 0;
            GetRawInputDeviceInfo(device, RIDI_DEVICENAME, IntPtr.Zero, ref size);
            if (size == 0) return "";

            // size is in characters
            IntPtr buffer = Marshal.AllocHGlobal((int)size * 2);
            try {
                if ((int)GetRawInputDeviceInfo(device, RIDI_DEVICENAME, buffer, ref size) <= 0) return "";
                return Marshal.PtrToStringUni(buffer);
            } finally {
                Marshal.FreeHGlobal(buffer);
            }
        }

        // same as getRawInputDeviceId() in src/electron/utils/hidRawInput.ts
        static string GetDeviceId(string name) {
            string id = name.ToLowerInvariant();

            int classIndex = id.LastIndexOf("#{");
            if (classIndex > -1) id = id.Substring(0, classIndex);

            if (id.StartsWith("\\\\?\\") || id.StartsWith("\\??\\")) id = id.Substring(4);
            return id;
        }
    }
}
