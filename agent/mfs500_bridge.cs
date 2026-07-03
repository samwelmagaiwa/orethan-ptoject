// MFS500 32-bit bridge — uses MorFin_Auth.dll (.NET C++/CLI managed wrapper)
// Compiled: csc /platform:x86 /reference:MorFin_Auth.dll /out:mfs500_bridge.exe mfs500_bridge.cs
// stdin  <- {"cmd":"status"} | {"cmd":"init"} | {"cmd":"capture","timeout":15000} | {"cmd":"close"}
// stdout -> {"ok":true,...} | {"ok":false,"error":"..."}
using System;
using System.Text;
using MorFin_Auth;

class Bridge
{
    static MorFinAuth _auth = null;
    static FINGER_DEVICE_INFO _devInfo;
    static bool _inited = false;

    static void Out(string json) { Console.WriteLine(json); Console.Out.Flush(); }
    static void OK(string kvs)   { Out("{\"ok\":true," + kvs + "}"); }
    static void Fail(string msg) { Out("{\"ok\":false,\"error\":\"" + Esc(msg) + "\"}"); }
    static string Esc(string s)
    {
        if (s == null) return "";
        return s.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","").Replace("\n","\\n");
    }

    static string Str(string line, string key)
    {
        string k = "\"" + key + "\"";
        int i = line.IndexOf(k);
        if (i < 0) return null;
        int c = line.IndexOf(':', i + k.Length);
        if (c < 0) return null;
        string rest = line.Substring(c + 1).TrimStart();
        if (rest.Length == 0) return null;
        if (rest[0] == '"') {
            int e = rest.IndexOf('"', 1);
            return e < 0 ? null : rest.Substring(1, e - 1);
        }
        var sb = new StringBuilder();
        foreach (char ch in rest) { if (char.IsDigit(ch) || ch == '-') sb.Append(ch); else break; }
        return sb.Length > 0 ? sb.ToString() : null;
    }

    static void Main()
    {
        Console.InputEncoding  = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        _auth = new MorFinAuth();

        string line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.Length == 0) continue;
            string cmd = Str(line, "cmd") ?? "";
            try
            {
                if (cmd == "status")
                {
                    int r = _auth.IsConnected("");   // empty = check any connected device
                    OK("\"connected\":" + (r == 0 ? "true" : "false") + ",\"conn_code\":" + r);
                }
                else if (cmd == "init")
                {
                    if (_inited) { OK("\"handle\":1,\"reused\":true"); continue; }
                    _devInfo = new FINGER_DEVICE_INFO();
                    // Accept optional "model" arg, else try common Mantra models in order
                    string modelHint = Str(line, "model");
                    string[] candidates = modelHint != null
                        ? new string[] { modelHint }
                        : new string[] { "MFS500", "MFS100", "MFS110", "MFS1000", "MANTRA_MFS500" };
                    int r = -1;
                    string usedModel = "";
                    foreach (string m in candidates) {
                        r = _auth.Init(m, ref _devInfo, "");
                        if (r == 0) { usedModel = m; break; }
                    }
                    if (r == 0) {
                        _inited = true;
                        string serial = Esc(_devInfo.SerialNo ?? "");
                        string model  = Esc(_devInfo.Model  ?? usedModel);
                        OK("\"handle\":1,\"serial\":\"" + serial + "\",\"model\":\"" + model + "\"");
                    } else {
                        Fail("Init failed (code=" + r + "): " + Esc(_auth.GetErrDescription(r)));
                    }
                }
                else if (cmd == "capture")
                {
                    if (!_inited) { Fail("not initialised"); continue; }
                    int timeout = 15000;
                    string ts = Str(line, "timeout");
                    if (ts != null) int.TryParse(ts, out timeout);

                    int qlt = 0, nfiq = 0;
                    int r = _auth.AutoCapture(out qlt, out nfiq, timeout, 40);
                    if (r != 0) {
                        Fail("AutoCapture failed (code=" + r + "): " + Esc(_auth.GetErrDescription(r)));
                        continue;
                    }

                    byte[] tmpl = null;
                    int r2 = _auth.GetTemplate(out tmpl, TEMPLATE_FORMAT.ANSI_V378, 1);
                    string tmplB64 = (r2 == 0 && tmpl != null && tmpl.Length > 0)
                        ? Convert.ToBase64String(tmpl) : "";

                    // Fingerprint image (BMP) for voucher printing
                    byte[] imgBytes = null;
                    int r3 = _auth.GetImage(out imgBytes, IMAGE_FORMAT.BMP, 1);
                    string imgB64 = (r3 == 0 && imgBytes != null && imgBytes.Length > 0)
                        ? Convert.ToBase64String(imgBytes) : "";

                    OK("\"quality\":" + qlt + ",\"nfiq\":" + nfiq
                        + ",\"template\":\"" + tmplB64 + "\""
                        + ",\"image\":\"" + imgB64 + "\"");
                }
                else if (cmd == "match")
                {
                    // {"cmd":"match","probe":"<b64>","gallery":"<b64>"}
                    string probeB64   = Str(line, "probe");
                    string galleryB64 = Str(line, "gallery");
                    if (probeB64 == null || galleryB64 == null || !_inited)
                        { Fail("match requires init + probe + gallery"); continue; }
                    byte[] probe   = Convert.FromBase64String(probeB64);
                    byte[] gallery = Convert.FromBase64String(galleryB64);
                    int score = 0;
                    int rm = _auth.MatchTemplate(probe, probe.Length, gallery, gallery.Length,
                                                  out score, TEMPLATE_FORMAT.ANSI_V378);
                    if (rm == 0)
                        OK("\"score\":" + score + ",\"match\":" + (score >= 40 ? "true" : "false"));
                    else
                        Fail("MatchTemplate failed (code=" + rm + ")");
                }
                else if (cmd == "close")
                {
                    if (_inited) { _auth.Uninit(); _inited = false; }
                    OK("\"closed\":true");
                }
                else
                {
                    Fail("unknown cmd: " + cmd);
                }
            }
            catch (Exception ex) { Fail(ex.GetType().Name + ": " + ex.Message); }
        }
        if (_inited) try { _auth.Uninit(); } catch {}
    }
}
