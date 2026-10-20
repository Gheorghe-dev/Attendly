using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Runtime.InteropServices;
using System.Text;

class QRAttendanceLauncher
{
    // Win32: set console title and hide/show window
    [DllImport("kernel32.dll")] static extern bool SetConsoleTitle(string title);
    [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")]   static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    const int SW_NORMAL = 1;

    static void Main()
    {
        SetConsoleTitle("QR Attendance System — Starting…");
        IntPtr console = GetConsoleWindow();
        ShowWindow(console, SW_NORMAL);

        Console.OutputEncoding = Encoding.UTF8;

        string appDir = Path.GetDirectoryName(
            System.Reflection.Assembly.GetExecutingAssembly().Location);

        PrintBanner();

        // ── 1. Kill any process already using port 3000 ──────────────────
        Console.WriteLine("  Checking port 3000…");
        KillPort(3000);
        Thread.Sleep(400);

        // ── 2. Launch Next.js dev server ─────────────────────────────────
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("\n  Starting Next.js server…");
        Console.ResetColor();

        Process server = new Process();
        server.StartInfo.FileName               = "cmd.exe";
        server.StartInfo.Arguments              = "/c npm run dev";
        server.StartInfo.WorkingDirectory       = appDir;
        server.StartInfo.UseShellExecute        = false;
        server.StartInfo.RedirectStandardOutput = true;
        server.StartInfo.RedirectStandardError  = true;
        server.StartInfo.CreateNoWindow         = false;

        bool ready = false;
        server.OutputDataReceived += (s, e) => {
            if (e.Data == null) return;
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine("  » " + e.Data);
            Console.ResetColor();
            if (e.Data.Contains("Ready") || e.Data.Contains("Local:")) ready = true;
        };
        server.ErrorDataReceived += (s, e) => {
            if (e.Data == null) return;
            Console.ForegroundColor = ConsoleColor.DarkGray;
            Console.WriteLine("  » " + e.Data);
            Console.ResetColor();
            if (e.Data.Contains("Ready") || e.Data.Contains("Local:")) ready = true;
        };

        server.Start();
        server.BeginOutputReadLine();
        server.BeginErrorReadLine();

        // ── 3. Wait until server is ready (max 30 s) ─────────────────────
        Console.Write("\n  Waiting for server");
        int waited = 0;
        while (!ready && waited < 30)
        {
            Thread.Sleep(1000);
            Console.Write(".");
            waited++;
        }
        Console.WriteLine();

        if (!ready)
        {
            // Give it a couple more seconds even if we missed the message
            Thread.Sleep(2000);
        }

        // ── 4. Open browser ───────────────────────────────────────────────
        string url = "http://localhost:3000";
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("\n  ✓ Opening " + url + " …");
        Console.ResetColor();

        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            // Fallback: use explorer
            Process.Start("explorer.exe", url);
        }

        // ── 5. Keep console alive ─────────────────────────────────────────
        SetConsoleTitle("QR Attendance System — Running on http://localhost:3000");
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n  ════════════════════════════════════════════");
        Console.WriteLine("   App is running at http://localhost:3000");
        Console.WriteLine("   Keep this window open while using the app.");
        Console.WriteLine("   Press Ctrl+C or close this window to stop.");
        Console.WriteLine("  ════════════════════════════════════════════");
        Console.ResetColor();

        try { server.WaitForExit(); }
        catch { }
    }

    static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.WriteLine();
        Console.WriteLine("  ╔══════════════════════════════════════════╗");
        Console.WriteLine("  ║       QR ATTENDANCE SYSTEM               ║");
        Console.WriteLine("  ║       University Edition                 ║");
        Console.WriteLine("  ╚══════════════════════════════════════════╝");
        Console.ResetColor();
        Console.WriteLine();
    }

    static void KillPort(int port)
    {
        try
        {
            // netstat to find pid on port 3000
            Process netstat = new Process();
            netstat.StartInfo.FileName               = "cmd.exe";
            netstat.StartInfo.Arguments              = "/c netstat -ano | findstr :" + port;
            netstat.StartInfo.UseShellExecute        = false;
            netstat.StartInfo.RedirectStandardOutput = true;
            netstat.StartInfo.CreateNoWindow         = true;
            netstat.Start();
            string output = netstat.StandardOutput.ReadToEnd();
            netstat.WaitForExit();

            foreach (string line in output.Split('\n'))
            {
                string[] parts = line.Trim().Split(new char[]{' '}, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 5 && parts[1].EndsWith(":" + port))
                {
                    if (int.TryParse(parts[parts.Length - 1], out int pid) && pid > 4)
                    {
                        try { Process.GetProcessById(pid).Kill(); } catch {}
                        Console.WriteLine("  Freed port " + port + " (pid " + pid + ")");
                    }
                }
            }
        }
        catch { /* non-fatal */ }
    }
}
