using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Automation;

internal static class NativeDemoDriver
{
    private const uint MouseMove = 0x0001;
    private const uint LeftDown = 0x0002;
    private const uint LeftUp = 0x0004;
    private const uint MouseWheel = 0x0800;
    private const uint KeyUp = 0x0002;
    private const uint Unicode = 0x0004;
    private const ushort VkMenu = 0x12;
    private const ushort VkD = 0x44;
    private const ushort VkReturn = 0x0D;

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct Input
    {
        public uint Type;
        public InputUnion Data;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MouseInput Mouse;
        [FieldOffset(0)] public KeyboardInput Keyboard;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int Dx;
        public int Dy;
        public uint MouseData;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardInput
    {
        public ushort VirtualKey;
        public ushort ScanCode;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }

    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] private static extern uint SendInput(uint count, Input[] inputs, int size);

    private static AutomationElement AppWindow;

    public static int Main()
    {
        try
        {
            AppWindow = WaitForWindow("Recovery Platform", 15000);
            Activate(AppWindow);
            Pause(4500);

            ClickExact("New recovery");
            WaitForExact("Case title", ControlType.Edit, 10000);
            Fill("Case title", "SHUNYA Full Screen Recovery Demo");
            Fill("Operator name or ID", "Demo Operator");
            Fill("Reference number", "DEMO-FULLSCREEN-001");
            Fill("Organization or unit", "Digital Forensics Lab");
            Fill("Notes", "Controlled read-only recovery from a prepared USB disk image.");
            HoverExact("The source remains read only.", 1400);

            ClickExact("Continue to workspace");
            WaitForExact("Choose parent folder", ControlType.Button, 10000);
            ClickExact("Choose parent folder");
            SelectFolder(@"C:\Users\J R Deva Dattan\Desktop\SHUNYA_Demo_Workspaces");

            AppWindow = WaitForWindow("Recovery Platform", 10000);
            Activate(AppWindow);
            WaitForExact("Continue to review", ControlType.Button, 15000);
            HoverContains("Storage on", 2200);
            HoverContains("What will be created", 2200);
            ClickExact("Continue to review");

            WaitForExact("Create case", ControlType.Button, 10000);
            HoverContains("Ready to create the case", 2200);
            ClickExact("Create case");

            WaitForContains("Select recovery source", 20000);
            HoverContains("SanDisk Ultra", 1800);
            Fill("Disk image path", @"E:\SHUNYA_DEMO_SOURCE_2026-08-30\carving-fixture.raw");
            ClickExact("Add image source");

            WaitForContains("Source safety assessment", 20000);
            HoverContains("Read only", 1800);
            ClickExact("Choose recovery goal");

            WaitForContains("What do you want to recover?", 15000);
            HoverContains("Recover deleted files", 1300);
            ClickContains("Recover everything");
            ClickExact("Continue to scan options");

            WaitForContains("Choose scan options", 15000);
            HoverContains("Full Scan", 1700);
            ClickButtonInsideNamedAncestor("Full Scan", "Use this preset");

            WaitForContains("Partitions found", 20000);
            HoverContains("Detected layout", 2300);
            HoverContains("Source remains unchanged", 1800);

            ClickExact("Case activity");
            WaitForContains("Case activity", 15000);
            HoverContains("Recorded timeline", 1400);
            Scroll(-740);
            Pause(3000);
            Scroll(-740);
            Pause(3200);

            ClickExact("Verify");
            WaitForContains("Recovery results", 15000);
            HoverContains("Recovered JPEG", 2000);
            HoverContains("SHA-256 recorded", 2200);
            HoverContains("Source byte ranges", 2200);

            ClickExact("Reports");
            WaitForContains("Recovery report", 15000);
            ClickExact("Generate report");
            WaitForContains("Report output ready", 20000);
            HoverContains("JSON evidence record", 2200);
            HoverContains("Warnings and limitations", 2500);

            ClickExact("Cases");
            WaitForContains("Your recovery cases", 15000);
            HoverContains("SHUNYA Full Screen Recovery Demo", 5000);
            Console.WriteLine("SHUNYA_NATIVE_DEMO_COMPLETE");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("SHUNYA_NATIVE_DEMO_FAILED: " + error);
            return 1;
        }
    }

    private static void SelectFolder(string path)
    {
        AutomationElement dialog = WaitForWindow("Choose a recovery case workspace", 15000);
        Activate(dialog);
        Pause(1200);
        KeyChord(VkMenu, VkD);
        TypeText(path, 24);
        Key(VkReturn);
        Pause(2200);
        AutomationElement select = WaitForElement(dialog, delegate(AutomationElement e)
        {
            return IsVisible(e) && e.Current.ControlType == ControlType.Button &&
                e.Current.Name.IndexOf("Select", StringComparison.OrdinalIgnoreCase) >= 0 &&
                e.Current.Name.IndexOf("folder", StringComparison.OrdinalIgnoreCase) >= 0;
        }, 10000);
        Click(select);
        Pause(3200);
    }

    private static void Fill(string name, string value)
    {
        AutomationElement edit = WaitForExact(name, ControlType.Edit, 12000);
        Click(edit);
        TypeText(value, 42);
        Pause(450);
    }

    private static void ClickExact(string name)
    {
        AutomationElement element = WaitForElement(AppWindow, delegate(AutomationElement e)
        {
            if (!IsVisible(e) || !String.Equals(e.Current.Name, name, StringComparison.OrdinalIgnoreCase)) return false;
            ControlType type = e.Current.ControlType;
            return type == ControlType.Button || type == ControlType.Hyperlink || type == ControlType.ListItem;
        }, 15000);
        Click(element);
        Pause(1400);
    }

    private static void ClickContains(string text)
    {
        AutomationElement element = WaitForElement(AppWindow, delegate(AutomationElement e)
        {
            if (!IsVisible(e) || e.Current.Name.IndexOf(text, StringComparison.OrdinalIgnoreCase) < 0) return false;
            ControlType type = e.Current.ControlType;
            return type == ControlType.Button || type == ControlType.Hyperlink;
        }, 15000);
        Click(element);
        Pause(1400);
    }

    private static void ClickButtonInsideNamedAncestor(string ancestorText, string buttonName)
    {
        AutomationElement label = WaitForContains(ancestorText, 15000);
        AutomationElement current = label;
        for (int depth = 0; depth < 7 && current != null; depth++)
        {
            AutomationElement button = FindElement(current, delegate(AutomationElement e)
            {
                return IsVisible(e) && e.Current.ControlType == ControlType.Button &&
                    String.Equals(e.Current.Name, buttonName, StringComparison.OrdinalIgnoreCase);
            });
            if (button != null)
            {
                Click(button);
                Pause(1800);
                return;
            }
            current = TreeWalker.ControlViewWalker.GetParent(current);
        }
        throw new InvalidOperationException("Could not locate " + buttonName + " inside " + ancestorText);
    }

    private static void HoverExact(string name, int milliseconds)
    {
        AutomationElement element = WaitForElement(AppWindow, delegate(AutomationElement e)
        {
            return IsVisible(e) && String.Equals(e.Current.Name, name, StringComparison.OrdinalIgnoreCase);
        }, 10000);
        MoveTo(element);
        Pause(milliseconds);
    }

    private static void HoverContains(string text, int milliseconds)
    {
        AutomationElement element = WaitForContains(text, 10000);
        MoveTo(element);
        Pause(milliseconds);
    }

    private static AutomationElement WaitForExact(string name, ControlType type, int timeout)
    {
        return WaitForElement(AppWindow, delegate(AutomationElement e)
        {
            return IsVisible(e) && e.Current.ControlType == type &&
                String.Equals(e.Current.Name, name, StringComparison.OrdinalIgnoreCase);
        }, timeout);
    }

    private static AutomationElement WaitForContains(string text, int timeout)
    {
        return WaitForElement(AppWindow, delegate(AutomationElement e)
        {
            return IsVisible(e) && e.Current.Name.IndexOf(text, StringComparison.OrdinalIgnoreCase) >= 0;
        }, timeout);
    }

    private static AutomationElement WaitForWindow(string title, int timeout)
    {
        DateTime end = DateTime.UtcNow.AddMilliseconds(timeout);
        while (DateTime.UtcNow < end)
        {
            AutomationElement found = AutomationElement.RootElement.FindFirst(
                TreeScope.Children,
                new PropertyCondition(AutomationElement.NameProperty, title));
            if (found != null) return found;
            Pause(180);
        }
        throw new TimeoutException("Window not found: " + title);
    }

    private static AutomationElement WaitForElement(AutomationElement root, Predicate<AutomationElement> predicate, int timeout)
    {
        DateTime end = DateTime.UtcNow.AddMilliseconds(timeout);
        while (DateTime.UtcNow < end)
        {
            AutomationElement found = FindElement(root, predicate);
            if (found != null) return found;
            Pause(180);
        }
        throw new TimeoutException("UI element was not found before timeout.");
    }

    private static AutomationElement FindElement(AutomationElement root, Predicate<AutomationElement> predicate)
    {
        AutomationElementCollection elements = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
        foreach (AutomationElement element in elements)
        {
            try { if (predicate(element)) return element; }
            catch (ElementNotAvailableException) { }
        }
        return null;
    }

    private static bool IsVisible(AutomationElement element)
    {
        try
        {
            System.Windows.Rect rect = element.Current.BoundingRectangle;
            return !element.Current.IsOffscreen && rect.Width > 2 && rect.Height > 2;
        }
        catch (ElementNotAvailableException) { return false; }
    }

    private static void Activate(AutomationElement window)
    {
        int handle = window.Current.NativeWindowHandle;
        if (handle != 0) SetForegroundWindow(new IntPtr(handle));
        Pause(700);
    }

    private static void MoveTo(AutomationElement element)
    {
        System.Windows.Rect rect = element.Current.BoundingRectangle;
        int x = (int)(rect.Left + Math.Min(rect.Width * 0.55, rect.Width - 8));
        int y = (int)(rect.Top + rect.Height * 0.55);
        SmoothMove(x, y, 520);
    }

    private static void Click(AutomationElement element)
    {
        MoveTo(element);
        Pause(260);
        Input[] inputs = new Input[2];
        inputs[0].Type = 0; inputs[0].Data.Mouse.Flags = LeftDown;
        inputs[1].Type = 0; inputs[1].Data.Mouse.Flags = LeftUp;
        SendInput(2, inputs, Marshal.SizeOf(typeof(Input)));
        Pause(350);
    }

    private static void SmoothMove(int targetX, int targetY, int duration)
    {
        Point start;
        GetCursorPos(out start);
        int steps = Math.Max(18, duration / 14);
        for (int index = 1; index <= steps; index++)
        {
            double t = (double)index / steps;
            double eased = t * t * (3.0 - 2.0 * t);
            int x = start.X + (int)((targetX - start.X) * eased);
            int y = start.Y + (int)((targetY - start.Y) * eased);
            SetCursorPos(x, y);
            Pause(Math.Max(1, duration / steps));
        }
    }

    private static void TypeText(string text, int delay)
    {
        foreach (char character in text)
        {
            Input[] inputs = new Input[2];
            inputs[0].Type = 1;
            inputs[0].Data.Keyboard.ScanCode = character;
            inputs[0].Data.Keyboard.Flags = Unicode;
            inputs[1].Type = 1;
            inputs[1].Data.Keyboard.ScanCode = character;
            inputs[1].Data.Keyboard.Flags = Unicode | KeyUp;
            SendInput(2, inputs, Marshal.SizeOf(typeof(Input)));
            Pause(delay);
        }
    }

    private static void Key(ushort virtualKey)
    {
        Input[] inputs = new Input[2];
        inputs[0].Type = 1; inputs[0].Data.Keyboard.VirtualKey = virtualKey;
        inputs[1].Type = 1; inputs[1].Data.Keyboard.VirtualKey = virtualKey; inputs[1].Data.Keyboard.Flags = KeyUp;
        SendInput(2, inputs, Marshal.SizeOf(typeof(Input)));
        Pause(300);
    }

    private static void KeyChord(ushort modifier, ushort key)
    {
        Input[] inputs = new Input[4];
        inputs[0].Type = 1; inputs[0].Data.Keyboard.VirtualKey = modifier;
        inputs[1].Type = 1; inputs[1].Data.Keyboard.VirtualKey = key;
        inputs[2].Type = 1; inputs[2].Data.Keyboard.VirtualKey = key; inputs[2].Data.Keyboard.Flags = KeyUp;
        inputs[3].Type = 1; inputs[3].Data.Keyboard.VirtualKey = modifier; inputs[3].Data.Keyboard.Flags = KeyUp;
        SendInput(4, inputs, Marshal.SizeOf(typeof(Input)));
        Pause(400);
    }

    private static void Scroll(int delta)
    {
        Input[] inputs = new Input[1];
        inputs[0].Type = 0;
        inputs[0].Data.Mouse.MouseData = unchecked((uint)delta);
        inputs[0].Data.Mouse.Flags = MouseWheel;
        SendInput(1, inputs, Marshal.SizeOf(typeof(Input)));
        Pause(750);
    }

    private static void Pause(int milliseconds) { Thread.Sleep(milliseconds); }
}
