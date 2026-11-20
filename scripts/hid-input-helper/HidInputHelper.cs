using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Windows does not allow reading keyboard devices (most presentation clickers) as HID devices,
// so this reads them through Raw Input instead, which also works when FreeShow is not focused.
// Only devices FreeShow listens to are reported, key presses still reach the focused app.

namespace HidInputHelper {
    class Program {
        const int WM_INPUT = 0x00FF;
        const int RIDEV_INPUTSINK = 0x0100;
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

        static readonly object sync = new object();
        static readonly HashSet<string> watched = new HashSet<string>();
        static readonly Dictionary<string, long> pressedTicks = new Dictionary<string, long>();

        [STAThread]
        static void Main() {
            try {
                InputWindow window = new InputWindow();
                RAWINPUTDEVICE[] dev = {
                    new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 6, dwFlags = RIDEV_INPUTSINK, hwndTarget = window.Handle }
                };

                if (!RegisterRawInputDevices(dev, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)))) {
                    Console.Error.WriteLine("RegisterRawInputDevices failed: " + Marshal.GetLastWin32Error());
                    Environment.Exit(1);
                }

                new Thread(ReadCommands) { IsBackground = true }.Start();
                Application.Run();
            } catch (Exception ex) {
                Console.Error.WriteLine("Main error: " + ex.Message);
            }
        }

        class InputWindow : NativeWindow {
            public InputWindow() { CreateHandle(new CreateParams()); }
            protected override void WndProc(ref Message m) {
                try {
                    if (m.Msg == WM_INPUT) ReadInput(m.LParam);
                } catch (Exception ex) {
                    Console.Error.WriteLine("WndProc error: " + ex.Message);
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
                    lock (sync) {
                        if (line[0] == '+') watched.Add(id);
                        else if (line[0] == '-') watched.Remove(id);
                    }
                }
            } catch {}
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

                RAWKEYBOARD kbd = (RAWKEYBOARD)Marshal.PtrToStructure(IntPtr.Add(buffer, (int)headerSize), typeof(RAWKEYBOARD));
                string name = GetDeviceName(header.hDevice);
                if (string.IsNullOrEmpty(name)) return;

                string id = GetDeviceId(name);
                lock (sync) {
                    if (!watched.Contains(id)) return;
                }

                int flags = kbd.Flags & (RI_KEY_E0 | RI_KEY_E1);
                string key = id + "|" + kbd.VKey + "|" + kbd.MakeCode + "|" + flags;
                long now = Environment.TickCount;

                lock (sync) {
                    if ((kbd.Flags & RI_KEY_BREAK) != 0) {
                        pressedTicks.Remove(key);
                        return;
                    }

                    long lastPress;
                    if (pressedTicks.TryGetValue(key, out lastPress) && (uint)(now - lastPress) < 1500) {
                        pressedTicks[key] = now;
                        return; // suppress auto-repeat while holding button down
                    }
                    pressedTicks[key] = now;
                }

                Console.Out.WriteLine(name + "\t" + kbd.VKey + "\t" + kbd.MakeCode + "\t" + flags);
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

            IntPtr buffer = Marshal.AllocHGlobal((int)size * 2);
            try {
                if ((int)GetRawInputDeviceInfo(device, RIDI_DEVICENAME, buffer, ref size) <= 0) return "";
                return Marshal.PtrToStringUni(buffer);
            } finally {
                Marshal.FreeHGlobal(buffer);
            }
        }

        static string GetDeviceId(string name) {
            string id = name.ToLowerInvariant();
            int classIndex = id.LastIndexOf("#{");
            if (classIndex > -1) id = id.Substring(0, classIndex);
            if (id.StartsWith("\\\\?\\") || id.StartsWith("\\??\\")) id = id.Substring(4);
            return id;
        }
    }
}
