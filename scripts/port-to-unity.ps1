Param()

$ErrorActionPreference = 'Stop'

# Paths
$ws = "C:\Users\Error\Desktop\pathheroes"
$unityRoot = "C:\Users\Error\PathHeroes"
$assetsSrc = Join-Path $ws 'assets'
$assetsDst = Join-Path $unityRoot 'Assets/PathHeroes/Resources/assets'
$scriptsDst = Join-Path $unityRoot 'Assets/PathHeroes/Scripts'
$packagesManifest = Join-Path $unityRoot 'Packages/manifest.json'

Write-Host "[PathHeroes] Начало переноса ассетов и кода в Unity проект: $unityRoot"

# Ensure directories
New-Item -ItemType Directory -Force -Path $assetsDst | Out-Null
New-Item -ItemType Directory -Force -Path $scriptsDst | Out-Null

# Copy assets preserving structure
Write-Host "[PathHeroes] Копирование ассетов..."
robocopy $assetsSrc $assetsDst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# SVG: пакет Vector Graphics — установите вручную в Unity (Window > Package Manager > com.unity.vectorgraphics).
Write-Host "[PathHeroes] Напоминание: установите пакет 'com.unity.vectorgraphics' через Unity Package Manager."

# Helper: write C# file
function Write-CSFile {
  param(
    [string] $Path,
    [string] $Content
  )
  $dir = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Content -Path $Path -Value $Content -Encoding UTF8
}

Write-Host "[PathHeroes] Генерация C# скриптов..."

$csNamespace = 'PathHeroes'

# Utils.cs
$utilsCs = @'
using System;
using System.Collections.Generic;

namespace PathHeroes {
  public static class Utils {
    public static int Clamp(int v, int min, int max) => Math.Max(min, Math.Min(max, v));
    public static float Clamp01(float v) => Math.Max(0f, Math.Min(1f, v));
    public static T ChoiceWeighted<T>(IReadOnlyList<(T key, int weight)> entries, Random rng) {
      if (entries == null || entries.Count == 0) return default(T);
      var total = 0; foreach (var e in entries) total += Math.Max(0, e.weight);
      var r = rng.Next(0, Math.Max(1, total));
      foreach (var e in entries) { r -= Math.Max(0, e.weight); if (r < 0) return e.key; }
      return entries[entries.Count - 1].key;
    }
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'Utils.cs') $utilsCs

# Characters.cs
$charactersCs = @'
using System.Collections.Generic;

namespace PathHeroes {
  public sealed class CharacterDef {
    public string Id;
    public string Name;
    public string Class;
    public string Faction;
    public int Hp;
    public int Atk;
    public float AtkSpeed;
    public int Chance;
    public string SpriteKey;
  }

  public static class CharactersConfig {
    public static readonly string[] ORDER = new [] { "executioner","elder","r9","assassin","fobos","lord","bastin","geomis","anubis","starlord" };
    public static readonly Dictionary<string, CharacterDef> DEF = new Dictionary<string, CharacterDef> {
      ["executioner"] = new CharacterDef { Id="executioner", Name="Палач", Class="мечник", Faction="melee", Hp=280, Atk=30, AtkSpeed=1f, Chance=30, SpriteKey="executioner" },
      ["elder"]       = new CharacterDef { Id="elder", Name="Старейшина", Class="маг", Faction="mage", Hp=440, Atk=75, AtkSpeed=0.5f, Chance=20, SpriteKey="elder" },
      ["r9"]          = new CharacterDef { Id="r9", Name="R-9", Class="робот", Faction="robot", Hp=860, Atk=40, AtkSpeed=3f, Chance=15, SpriteKey="r9" },
      ["assassin"]    = new CharacterDef { Id="assassin", Name="Ассасин", Class="мечник", Faction="melee", Hp=170, Atk=40, AtkSpeed=2f, Chance=25, SpriteKey="assassin" },
      ["fobos"]       = new CharacterDef { Id="fobos", Name="Fob0s", Class="робот", Faction="robot", Hp=1320, Atk=25, AtkSpeed=7f, Chance=5, SpriteKey="fobos" },
      ["lord"]        = new CharacterDef { Id="lord", Name="Лорд", Class="мечник", Faction="melee", Hp=1630, Atk=120, AtkSpeed=2f, Chance=5, SpriteKey="lord" },
      ["bastin"]      = new CharacterDef { Id="bastin", Name="Бастин", Class="мечник", Faction="melee", Hp=2420, Atk=200, AtkSpeed=3f, Chance=0, SpriteKey="bastin" },
      ["geomis"]      = new CharacterDef { Id="geomis", Name="Геомис", Class="маг", Faction="mage", Hp=2890, Atk=700, AtkSpeed=1f, Chance=0, SpriteKey="geomis" },
      ["anubis"]      = new CharacterDef { Id="anubis", Name="Анубис", Class="бог", Faction="god", Hp=4350, Atk=350, AtkSpeed=3f, Chance=0, SpriteKey="anubis" },
      ["starlord"]    = new CharacterDef { Id="starlord", Name="Star Lord", Class="космос", Faction="cosmos", Hp=7800, Atk=1500, AtkSpeed=1f, Chance=0, SpriteKey="starlord" },
    };

    public static readonly string[] STAR_ORDER = new [] { "fobos","lord","bastin","geomis","anubis","starlord" };
    public static readonly Dictionary<string, int> STAR_CHANCE = new Dictionary<string, int> {
      ["fobos"] = 30, ["lord"] = 30, ["bastin"] = 20, ["geomis"] = 10, ["anubis"] = 7, ["starlord"] = 3
    };
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'Characters.cs') $charactersCs

# State.cs
$stateCs = @'
using System;
using System.Collections.Generic;
using UnityEngine;

namespace PathHeroes {
  [Serializable]
  public class OwnedInstance { public int upgrade = 0; }

  [Serializable]
  public class DonationData { public int progress = 0; public int target = 0; public int total = 0; }

  [Serializable]
  public class AchievementsData { public int monstersKilled = 0; public int scrollsSpent = 0; public int series1_stage = 1; public int series2_stage = 1; public int series3_stage = 1; }

  [Serializable]
  public class SaveData {
    public int version = 1;
    public int scrolls = 0;
    public int starScrolls = 0;
    public int lifeStones = 0;
    public bool soundOn = true;
    public string musicVolume = "medium"; // low|medium|high
    public string graphicsQuality = "high"; // low|medium|high
    public DonationData donation = new DonationData();
    public AchievementsData achievements = new AchievementsData();
    public Dictionary<string, List<OwnedInstance>> owned = new Dictionary<string, List<OwnedInstance>>();
    public Dictionary<int, bool[]> completed = new Dictionary<int, bool[]>();
  }

  public sealed class State {
    public const string STORAGE_KEY = "pathheroes_save_v1";
    public const int ISLANDS = 5;
    public SaveData data { get; private set; }
    private static State _instance;
    public static State Instance => _instance ?? (_instance = new State());
    private System.Random _rng = new System.Random();

    private State() {
      Load();
    }

    private Dictionary<int, bool[]> MakeCompleted() {
      var d = new Dictionary<int, bool[]>();
      for (int i = 1; i <= ISLANDS; i++) d[i] = new bool[10];
      return d;
    }

    private void Normalize() {
      if (data.completed == null || data.completed.Count == 0) data.completed = MakeCompleted();
      if (data.owned == null) data.owned = new Dictionary<string, List<OwnedInstance>>();
      if (data.donation == null) data.donation = new DonationData();
      if (data.achievements == null) data.achievements = new AchievementsData();
      if (!IsValidDonationTarget(data.donation.target)) data.donation.target = PickDonationTarget();
    }

    public void Save() {
      var json = JsonUtility.ToJson(data);
      PlayerPrefs.SetString(STORAGE_KEY, json);
      PlayerPrefs.Save();
    }

    public void Load() {
      var raw = PlayerPrefs.GetString(STORAGE_KEY, string.Empty);
      if (string.IsNullOrEmpty(raw)) {
        data = new SaveData();
        data.completed = MakeCompleted();
        data.owned["executioner"] = new List<OwnedInstance> { new OwnedInstance(), new OwnedInstance(), new OwnedInstance() };
      } else {
        try { data = JsonUtility.FromJson<SaveData>(raw); } catch { data = new SaveData(); }
      }
      Normalize(); Save();
    }

    public bool HasAnyCharacters() {
      foreach (var kv in data.owned) if (kv.Value != null && kv.Value.Count > 0) return true; return false;
    }

    public int GetCompletedCountOnIsland(int island) {
      if (!data.completed.TryGetValue(island, out var arr) || arr == null) return 0; int c=0; foreach(var b in arr) if (b) c++; return c;
    }

    public bool IsIslandUnlocked(int island) {
      if (island == 1) return true; int prev = island - 1; if (!data.completed.TryGetValue(prev, out var arr)) return false; foreach (var b in arr) if (!b) return false; return true;
    }

    public bool IsLevelCompleted(int island, int level) { return data.completed.TryGetValue(island, out var arr) && arr != null && arr[Mathf.Clamp(level-1,0,9)]; }
    public bool CanPlayLevel(int island, int level) { return IsIslandUnlocked(island) && !IsLevelCompleted(island, level); }
    public void MarkLevelCompleted(int island, int level) { if (!data.completed.ContainsKey(island)) data.completed[island] = new bool[10]; data.completed[island][Mathf.Clamp(level-1,0,9)] = true; Save(); }

    public void AddScrolls(int amount) { data.scrolls = Utils.Clamp(data.scrolls + amount, 0, 999999); Save(); }
    public void AddStarScrolls(int amount) { data.starScrolls = Utils.Clamp(data.starScrolls + amount, 0, 999999); Save(); }
    public void AddStones(int amount) { data.lifeStones = Utils.Clamp(data.lifeStones + amount, 0, 999999); Save(); }
    public bool UseScroll() { if (data.scrolls <= 0) return false; data.scrolls--; data.achievements.scrollsSpent++; Save(); return true; }
    public bool UseStarScroll() { if (data.starScrolls <= 0) return false; data.starScrolls--; Save(); return true; }

    public void OwnCharacter(string charId, int countDelta = 1) {
      if (!data.owned.TryGetValue(charId, out var list) || list == null) { list = new List<OwnedInstance>(); data.owned[charId] = list; }
      for (int i = 0; i < countDelta; i++) list.Add(new OwnedInstance()); Save();
    }
    public List<OwnedInstance> GetInstances(string charId) { if (!data.owned.TryGetValue(charId, out var list) || list == null) { list = new List<OwnedInstance>(); data.owned[charId] = list; } return list; }
    public int TotalOwned(string charId) => GetInstances(charId).Count;
    public int GetUpgradeLevelInstance(string charId, int index) { var list = GetInstances(charId); return (index>=0 && index<list.Count) ? list[index].upgrade : 0; }
    public bool CanUpgradeInstance(string charId, int index) { var list = GetInstances(charId); if (index<0||index>=list.Count) return false; var inst = list[index]; return inst.upgrade < 10 && data.lifeStones >= GetUpgradeCost(charId, inst.upgrade + 1); }
    public int GetUpgradeCost(string charId, int targetLevel) => 5 * targetLevel;
    public bool ApplyUpgradeInstance(string charId, int index) { var list = GetInstances(charId); if (index<0||index>=list.Count) return false; var inst = list[index]; var target = Mathf.Clamp(inst.upgrade + 1, 0, 10); var cost = GetUpgradeCost(charId, target); if (data.lifeStones < cost) return false; data.lifeStones -= cost; inst.upgrade = target; Save(); return true; }
    public bool DeleteInstance(string charId, int index) { var list = GetInstances(charId); if (index<0||index>=list.Count) return false; list.RemoveAt(index); AddStones(5); Save(); return true; }

    public (int hp, int atk, float atkSpeed) GetCharacterDisplayStatsForUpgrade(string charId, int upgrade) {
      var baseDef = CharactersConfig.DEF[charId];
      return (baseDef.Hp + 50 * upgrade, baseDef.Atk + 5 * upgrade, baseDef.AtkSpeed);
    }

    private bool IsValidDonationTarget(int n) { int[] opts = new []{2,5,7,10,15,17,20,25}; foreach (var x in opts) if (x==n) return true; return false; }
    private int PickDonationTarget() { int[] opts = new []{2,5,7,10,15,17,20,25}; return opts[_rng.Next(0, opts.Length)]; }
    public (bool ok, (string type, object value)? reward) DonateOneStone() {
      if (data.lifeStones <= 0) return (false, null);
      data.lifeStones -= 1; data.donation.progress += 1; data.donation.total += 1;
      (string type, object value)? reward = null; bool reset = false;
      bool needResetByTotal = data.donation.total >= 25; bool reachedTarget = data.donation.progress >= data.donation.target;
      if (reachedTarget || needResetByTotal) { reward = RollDonationReward(data.donation.target); reset = true; }
      if (reset) { data.donation.progress = 0; data.donation.total = 0; data.donation.target = PickDonationTarget(); }
      Save(); return (true, reward);
    }
    private (string type, object value) RollDonationReward(int target) {
      int r = _rng.Next(0, 100);
      (string type, object value) Pick((string type, object value, int pct)[] table) {
        int acc = 0; foreach (var t in table) { acc += t.pct; if (r <= acc) return (t.type, t.value); } return ("nothing", 0);
      }
      switch (target) {
        case 2:  return Pick(new[]{ ("nothing",0,75), ("character","executioner",22), ("scroll",1,3) });
        case 5:  return Pick(new[]{ ("nothing",0,50), ("character","executioner",30), ("character","elder",15), ("scroll",1,5) });
        case 7:  return Pick(new[]{ ("nothing",0,45), ("character","r9",35), ("scroll",1,15), ("character","fobos",5) });
        case 10: return Pick(new[]{ ("nothing",0,40), ("character","r9",30), ("scroll",1,20), ("character","fobos",10) });
        case 15: return Pick(new[]{ ("nothing",0,30), ("scroll",1,35), ("character","lord",20), ("character","fobos",15) });
        case 17: return Pick(new[]{ ("nothing",0,20), ("scroll",1,40), ("character","lord",20), ("character","fobos",17), ("starScroll",1,3) });
        case 20: return Pick(new[]{ ("nothing",0,10), ("character","lord",40), ("character","fobos",40), ("starScroll",1,10) });
        case 25: return Pick(new[]{ ("character","lord",25), ("character","bastin",25), ("starScroll",1,50) });
        default: return ("nothing", 0);
      }
    }
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'State.cs') $stateCs

# GameController.cs (runtime bootstrap + very simple main menu scaffold)
$gameControllerCs = @'
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using System.Linq;

namespace PathHeroes {
  public sealed class GameController : MonoBehaviour {
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Bootstrap() {
      var go = new GameObject("PathHeroesController");
      DontDestroyOnLoad(go);
      go.AddComponent<GameController>();
    }

    private Canvas _canvas;
    private RectTransform _root;
    private Text _resScrolls;
    private Text _resStones;

    void Awake() {
      if (FindObjectOfType<EventSystem>() == null) { var es = new GameObject("EventSystem"); es.AddComponent<EventSystem>(); es.AddComponent<StandaloneInputModule>(); DontDestroyOnLoad(es); }
      BuildCanvas();
      BuildMainMenu();
    }

    void BuildCanvas() {
      var cgo = new GameObject("Canvas");
      _canvas = cgo.AddComponent<Canvas>(); _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
      cgo.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
      cgo.AddComponent<GraphicRaycaster>();
      DontDestroyOnLoad(cgo);
      _root = cgo.GetComponent<RectTransform>();
    }

    Button MakeButton(string text, Vector2 anchoredPos, Vector2 size, System.Action onClick) {
      var go = new GameObject("Button:"+text);
      go.transform.SetParent(_root, false);
      var rt = go.AddComponent<RectTransform>(); rt.sizeDelta = size; rt.anchoredPosition = anchoredPos;
      var img = go.AddComponent<Image>(); img.color = new Color(0.10f,0.20f,0.30f,0.95f);
      var btn = go.AddComponent<Button>(); btn.onClick.AddListener(()=>onClick?.Invoke());
      var tgo = new GameObject("Text"); tgo.transform.SetParent(go.transform, false);
      var trt = tgo.AddComponent<RectTransform>(); trt.anchorMin = new Vector2(0,0); trt.anchorMax = new Vector2(1,1); trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
      var txt = tgo.AddComponent<Text>(); txt.text = text; txt.alignment = TextAnchor.MiddleCenter; txt.color = new Color(0.91f,0.95f,1f); txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf"); txt.fontSize = 24;
      var outline = tgo.AddComponent<Outline>(); outline.effectColor = new Color(0.31f,0.89f,0.76f,0.8f);
      var cb = btn.colors; cb.highlightedColor = new Color(0.16f,0.34f,0.47f); cb.pressedColor = new Color(0.14f,0.28f,0.39f); btn.colors = cb;
      return btn;
    }

    Text MakeLabel(string text, Vector2 anchoredPos, int fontSize = 18, TextAnchor align = TextAnchor.MiddleCenter) {
      var go = new GameObject("Label"); go.transform.SetParent(_root, false);
      var rt = go.AddComponent<RectTransform>(); rt.anchoredPosition = anchoredPos; rt.sizeDelta = new Vector2(800, 40);
      var txt = go.AddComponent<Text>(); txt.text = text; txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf"); txt.fontSize = fontSize; txt.color = new Color(0.91f,0.95f,1f); txt.alignment = align; return txt;
    }

    void ClearUI() { foreach (Transform t in _root) Destroy(t.gameObject); }

    void BuildMainMenu() {
      ClearUI();
      MakeLabel("Path Heroes", new Vector2(0, 180), 48);
      MakeLabel("HTML5 RPG Auto-Battler (Unity порт)", new Vector2(0, 140), 18);
      var y = 60;
      MakeButton("Сюжет (Карта островов)", new Vector2(0, y), new Vector2(360, 68), () => BuildMap());
      y -= 78;
      MakeButton("Призыв", new Vector2(0, y), new Vector2(360, 68), () => BuildSummon(false));
      y -= 78;
      MakeButton("Инвентарь", new Vector2(0, y), new Vector2(360, 68), () => BuildInventory());
      y -= 78;
      MakeButton("Настройки", new Vector2(0, y), new Vector2(360, 68), () => BuildSettings());
      // Bottom resources bar
      _resScrolls = MakeLabel("", new Vector2(-180, -180), 18, TextAnchor.MiddleLeft);
      _resStones  = MakeLabel("", new Vector2( 260, -180), 18, TextAnchor.MiddleRight);
      RefreshResources();
    }

    void RefreshResources() {
      var s = State.Instance.data;
      _resScrolls.text = $"Свитки: {s.scrolls}  |  Звёздные: {s.starScrolls}";
      _resStones.text  = $"Камни жизни: {s.lifeStones}";
    }

    void BuildSettings() { ClearUI(); MakeLabel("Настройки (в разработке)", new Vector2(0, 140), 28); MakeButton("Назад", new Vector2(260, 220), new Vector2(140,44), ()=>BuildMainMenu()); }
    void BuildInventory() { ClearUI(); MakeLabel("Инвентарь (в разработке)", new Vector2(0, 140), 28); MakeButton("Назад", new Vector2(260, 220), new Vector2(140,44), ()=>BuildMainMenu()); }
    void BuildMap() { ClearUI(); MakeLabel("Карта островов (в разработке)", new Vector2(0, 140), 28); MakeButton("Назад", new Vector2(260, 220), new Vector2(140,44), ()=>BuildMainMenu()); }
    void BuildSummon(bool star) { ClearUI(); MakeLabel(star?"Звёздный призыв":"Призыв", new Vector2(0, 140), 28); MakeButton("Назад", new Vector2(260, 220), new Vector2(140,44), ()=>BuildMainMenu()); }
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'GameController.cs') $gameControllerCs

########################################
# Дополнительные скрипты (UI и экраны) #
########################################

# UI.cs — утилиты создания UI
$uiCs = @'
using UnityEngine;
using UnityEngine.UI;

namespace PathHeroes {
  public static class UI {
    public static GameObject Panel(Transform parent, string name, Vector2 size, Vector2 anchoredPos) {
      var go = new GameObject(name);
      go.transform.SetParent(parent, false);
      var rt = go.AddComponent<RectTransform>(); rt.sizeDelta = size; rt.anchoredPosition = anchoredPos;
      var img = go.AddComponent<Image>(); img.color = new Color(0.04f,0.08f,0.13f,0.95f);
      return go;
    }
    public static Button Button(Transform parent, string text, Vector2 size, Vector2 anchoredPos, System.Action onClick) {
      var go = new GameObject("Button:"+text); go.transform.SetParent(parent, false);
      var rt = go.AddComponent<RectTransform>(); rt.sizeDelta = size; rt.anchoredPosition = anchoredPos;
      var img = go.AddComponent<Image>(); img.color = new Color(0.10f,0.20f,0.30f,0.95f);
      var btn = go.AddComponent<Button>(); btn.onClick.AddListener(()=>onClick?.Invoke());
      var tgo = new GameObject("Text"); tgo.transform.SetParent(go.transform, false);
      var trt = tgo.AddComponent<RectTransform>(); trt.anchorMin = new Vector2(0,0); trt.anchorMax = new Vector2(1,1); trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
      var txt = tgo.AddComponent<Text>(); txt.text = text; txt.alignment = TextAnchor.MiddleCenter; txt.color = new Color(0.91f,0.95f,1f); txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf"); txt.fontSize = 22;
      return btn;
    }
    public static Text Label(Transform parent, string text, int size, Vector2 anchoredPos, TextAnchor align = TextAnchor.MiddleCenter) {
      var go = new GameObject("Label"); go.transform.SetParent(parent, false);
      var rt = go.AddComponent<RectTransform>(); rt.anchoredPosition = anchoredPos; rt.sizeDelta = new Vector2(900, 40);
      var txt = go.AddComponent<Text>(); txt.text = text; txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf"); txt.fontSize = size; txt.color = new Color(0.91f,0.95f,1f); txt.alignment = align; return txt;
    }
    public static Image Image(Transform parent, Sprite sprite, Vector2 size, Vector2 anchoredPos) {
      var go = new GameObject("Image"); go.transform.SetParent(parent, false);
      var rt = go.AddComponent<RectTransform>(); rt.sizeDelta = size; rt.anchoredPosition = anchoredPos;
      var img = go.AddComponent<Image>(); img.sprite = sprite; img.preserveAspect = true; img.color = Color.white; return img;
    }
    public static (Image bg, Image fg) Bar(Transform parent, Vector2 size, Vector2 anchoredPos, Color color) {
      var bgGo = new GameObject("BarBg"); bgGo.transform.SetParent(parent, false);
      var bgRt = bgGo.AddComponent<RectTransform>(); bgRt.sizeDelta = size; bgRt.anchoredPosition = anchoredPos;
      var bg = bgGo.AddComponent<Image>(); bg.color = new Color(0,0,0,0.4f);
      var fgGo = new GameObject("BarFg"); fgGo.transform.SetParent(parent, false);
      var fgRt = fgGo.AddComponent<RectTransform>(); fgRt.sizeDelta = size; fgRt.anchoredPosition = anchoredPos; fgRt.pivot = new Vector2(0,0.5f); fgRt.anchorMin = new Vector2(0.5f,0.5f); fgRt.anchorMax = new Vector2(0.5f,0.5f);
      var fg = fgGo.AddComponent<Image>(); fg.color = color;
      return (bg, fg);
    }
    public static void SetBar01(Image fg, float v01, float fullWidth) {
      var rt = fg.rectTransform; rt.sizeDelta = new Vector2(Mathf.Max(0, fullWidth * Mathf.Clamp01(v01)), rt.sizeDelta.y);
    }
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'UI.cs') $uiCs

# Game.cs — маршрутизация и экраны с логикой (упрощённый порт)
$gameCs = @'
using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace PathHeroes {
  public sealed class Game : MonoBehaviour {
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Bootstrap() {
      var go = new GameObject("PathHeroes");
      DontDestroyOnLoad(go);
      go.AddComponent<Game>();
    }

    private Canvas _canvas; private RectTransform _root;
    private Text _resScrolls; private Text _resStones;

    // Battle state
    private struct Unit { public string id; public string name; public int hp; public int atk; public float atkSpeed; public int currentHp; public bool alive; public string spriteKey; public string faction; public float invulnUntil; }
    private List<Unit?> playerTeam; private List<Unit?> enemyTeam;
    private List<Image> playerSprites; private List<Image> enemySprites; private List<Image> playerHpFg; private List<Image> enemyHpFg;
    private float sunBuffUntil = 0f; private bool battleEnded = false; private int killedEnemies = 0;

    void Awake() {
      BuildCanvas();
      BuildMainMenu();
    }

    void BuildCanvas() {
      var cgo = new GameObject("Canvas");
      _canvas = cgo.AddComponent<Canvas>(); _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
      var scaler = cgo.AddComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = new Vector2(960, 540);
      cgo.AddComponent<GraphicRaycaster>();
      DontDestroyOnLoad(cgo);
      _root = cgo.GetComponent<RectTransform>();
    }

    void ClearUI() { foreach (Transform t in _root) Destroy(t.gameObject); }

    void BuildMainMenu() {
      ClearUI();
      UI.Label(_root, "Path Heroes", 48, new Vector2(0, 180));
      UI.Label(_root, "Unity 2D порт", 18, new Vector2(0, 140));
      var y = 60;
      UI.Button(_root, "Сюжет (Карта островов)", new Vector2(360,68), new Vector2(0,y), () => BuildMap()); y -= 78;
      UI.Button(_root, "Призыв", new Vector2(360,68), new Vector2(0,y), () => BuildSummon(false));
      UI.Button(_root, "★", new Vector2(68,68), new Vector2(230,y), () => BuildSummon(true)); y -= 78;
      UI.Button(_root, "Инвентарь", new Vector2(360,68), new Vector2(0,y), () => BuildInventory()); y -= 78;
      UI.Button(_root, "Настройки", new Vector2(360,68), new Vector2(0,y), () => BuildSettings());
      UI.Button(_root, "Достижения", new Vector2(140,44), new Vector2(260,220), () => BuildAchievements());
      UI.Button(_root, "Дерево даров", new Vector2(140,44), new Vector2(260,170), () => BuildDonation());
      _resScrolls = UI.Label(_root, "", 18, new Vector2(-180, -200), TextAnchor.MiddleLeft);
      _resStones  = UI.Label(_root, "", 18, new Vector2( 260, -200), TextAnchor.MiddleRight);
      RefreshResources();
    }

    void RefreshResources() {
      var s = State.Instance.data;
      if (_resScrolls) _resScrolls.text = $"Свитки: {s.scrolls}  |  Звёздные: {s.starScrolls}";
      if (_resStones) _resStones.text  = $"Камни жизни: {s.lifeStones}";
    }

    // ========== Map ==========
    void BuildMap() {
      ClearUI();
      UI.Label(_root, "Карта островов", 28, new Vector2(-400, 220), TextAnchor.MiddleLeft);
      UI.Button(_root, "В меню", new Vector2(140,44), new Vector2(380, 220), () => BuildMainMenu());
      var points = new Vector2[] { new Vector2(-280, 80), new Vector2(-40, 140), new Vector2(200, 60), new Vector2(-80, -80), new Vector2(220, -120) };
      for (int i = 1; i <= State.ISLANDS; i++) {
        var pos = points[i-1];
        var unlocked = State.Instance.IsIslandUnlocked(i);
        var lbl = UI.Button(_root, $"Остров {i}", new Vector2(170,70), pos + new Vector2(0, 36), () => OpenIsland(i));
        var icon = Resources.Load<Sprite>($"assets/icons/icon-{new []{"jungle","beach","village","fog","desert"}[i-1]}");
        UI.Image(_root, icon, new Vector2(56,56), pos + new Vector2(0,-26));
        if (!unlocked) lbl.interactable = false;
        var done = State.Instance.GetCompletedCountOnIsland(i);
        UI.Label(_root, $"{done}/10 уровней", 14, pos + new Vector2(0, 80));
      }
    }

    int currentIsland = 1;
    void OpenIsland(int island) {
      currentIsland = island;
      // Панель уровней
      var panel = UI.Panel(_root, "IslandPanel", new Vector2(720, 360), Vector2.zero).GetComponent<RectTransform>();
      UI.Label(panel, $"Остров {island}", 24, new Vector2(0, 160));
      UI.Button(panel, "Закрыть", new Vector2(100,40), new Vector2(310, 160), () => { Destroy(panel.gameObject); });
      var completed = State.Instance.data.completed.ContainsKey(island) ? State.Instance.data.completed[island] : new bool[10];
      int nextPlayableIndex = System.Array.FindIndex(completed, v => v == false); if (nextPlayableIndex < 0) nextPlayableIndex = 10;
      int replayIndex = nextPlayableIndex > 0 ? nextPlayableIndex - 1 : -1;
      for (int i = 1; i <= 10; i++) {
        int col = (i-1) % 5; int row = (i-1)/5;
        var pos = new Vector2(-280 + col*140, -100 + row*140);
        int idx = i-1; bool isCompleted = completed[idx]; bool isNext = (idx == nextPlayableIndex); bool isReplay = (idx == replayIndex);
        var label = isCompleted && idx!=replayIndex ? $"Пройден\n{i}" : isNext ? $"Уровень\n{i}" : isReplay ? $"Повтор\n{i}" : $"Закрыто\n{i}";
        var btn = UI.Button(panel, label, new Vector2(120,80), pos, () => PickLevel(i));
        if (!(isNext || isReplay)) btn.interactable = false;
      }
    }

    void PickLevel(int level) {
      var completed = State.Instance.data.completed.ContainsKey(currentIsland) ? State.Instance.data.completed[currentIsland] : new bool[10];
      int nextPlayableIndex = System.Array.FindIndex(completed, v => v == false); if (nextPlayableIndex < 0) nextPlayableIndex = 10;
      int replayIndex = nextPlayableIndex > 0 ? nextPlayableIndex - 1 : -1;
      int idx = level - 1; bool replay = (idx == replayIndex);
      if (!(idx == nextPlayableIndex || replay)) return;
      BuildPrepare(currentIsland, level, replay);
    }

    // ========== Prepare ==========
    List<(string id,int index)> selection = new List<(string,int)>(); int pageIndex = 0; const int perPage = 6; List<(GameObject card,string key)> cards = new List<(GameObject,string)>(); List<(string id,int idx)> flat;
    void BuildPrepare(int island, int level, bool replay) {
      ClearUI();
      UI.Label(_root, $"Подготовка к бою — Остров {island}, Уровень {level}", 26, new Vector2(-400, 220), TextAnchor.MiddleLeft);
      UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), () => BuildMap());
      // enemy preview (простая полоска)
      UI.Label(_root, "Предстоящие враги", 20, new Vector2(300, 120));
      var enemies = GenerateMonsterTeam(island, level);
      for (int i = 0; i < 5; i++) if (enemies[i].HasValue) UI.Image(_root, LoadSprite(enemies[i]!.Value.spriteKey), new Vector2(48,48), new Vector2(300, 160 + i*60));
      // list
      selection.Clear(); pageIndex = 0; BuildFlat(); RenderCards(island, level, replay);
      var counter = UI.Label(_root, "Выбрано: 0/5", 20, new Vector2(0, -140));
      var startBtn = UI.Button(_root, "В бой", new Vector2(280,60), new Vector2(0, -190), () => StartBattle(island, level, replay));
      StartCoroutine(CoRefreshPrepare(counter, startBtn));
    }
    IEnumerator CoRefreshPrepare(Text counter, Button startBtn) {
      while (counter && startBtn) {
        counter.text = $"Выбрано: {selection.Count}/5";
        startBtn.interactable = selection.Count >= 1;
        yield return null;
      }
    }
    void BuildFlat() {
      flat = new List<(string,int)>();
      foreach (var id in CharactersConfig.ORDER) {
        var list = State.Instance.GetInstances(id);
        for (int i = 0; i < list.Count; i++) flat.Add((id, i));
      }
    }
    void RenderCards(int island, int level, bool replay) {
      foreach (var c in cards) Destroy(c.card); cards.Clear();
      int start = pageIndex * perPage; int end = Mathf.Min(flat.Count, start + perPage);
      int colBaseX = -320; int rowBaseY = 40; int gapX = 220; int gapY = 140; int posIdx = 0;
      for (int i = start; i < end; i++) {
        int col = posIdx % 3; int row = posIdx / 3; posIdx++;
        var (id, idx) = flat[i];
        var card = UI.Panel(_root, "Card", new Vector2(200, 120), new Vector2(colBaseX + col*gapX, rowBaseY - row*gapY));
        var up = State.Instance.GetUpgradeLevelInstance(id, idx);
        var stats = State.Instance.GetCharacterDisplayStatsForUpgrade(id, up);
        UI.Image(card.transform, LoadSprite(CharactersConfig.DEF[id].SpriteKey), new Vector2(56,56), new Vector2(-72, 0));
        UI.Label(card.transform, $"{CharactersConfig.DEF[id].Name} #{idx+1}", 16, new Vector2(-20, -24), TextAnchor.MiddleLeft);
        UI.Label(card.transform, $"HP {stats.Item1}  ATK {stats.Item2}\nLV {up}/10", 14, new Vector2(-20, 6), TextAnchor.MiddleLeft);
        var key = $"{id}#{idx}"; var bgBtn = card.AddComponent<Button>();
        bgBtn.onClick.AddListener(()=>ToggleSelect(key, card.GetComponent<Image>()));
        cards.Add((card, key));
      }
      if (pageIndex > 0) UI.Button(_root, "<", new Vector2(80,40), new Vector2(-60, -60), ()=>{ pageIndex--; RenderCards(island, level, replay); });
      if (end < flat.Count) UI.Button(_root, ">", new Vector2(80,40), new Vector2(60, -60), ()=>{ pageIndex++; RenderCards(island, level, replay); });
      RefreshSelectionBadges();
    }
    void ToggleSelect(string key, Image img) {
      var exists = selection.FindIndex(t => $"{t.id}#{t.index}" == key);
      if (exists >= 0) selection.RemoveAt(exists); else if (selection.Count < 5) {
        var parts = key.Split('#'); selection.Add((parts[0], int.Parse(parts[1])));
      }
      img.color = exists>=0 ? new Color(0.04f,0.08f,0.13f,0.95f) : new Color(0.10f,0.26f,0.36f,0.95f);
      RefreshSelectionBadges();
    }
    void RefreshSelectionBadges() {
      var indexByKey = new System.Collections.Generic.Dictionary<string,int>();
      for (int i = 0; i < selection.Count; i++) indexByKey[$"{selection[i].id}#{selection[i].index}"] = i+1;
      foreach (var (card, key) in cards) {
        var t = card.transform.Find("Badge") as RectTransform;
        if (!indexByKey.TryGetValue(key, out var n)) { if (t) Destroy(t.gameObject); continue; }
        if (!t) {
          var badge = new GameObject("Badge"); badge.transform.SetParent(card.transform, false);
          var rt = badge.AddComponent<RectTransform>(); rt.sizeDelta = new Vector2(28, 28); rt.anchoredPosition = new Vector2(88, -48);
          var img = badge.AddComponent<Image>(); img.color = new Color(1f,0.84f,0.31f,0.95f);
          var txt = new GameObject("Txt").AddComponent<Text>(); txt.transform.SetParent(badge.transform, false); txt.rectTransform.anchorMin = Vector2.zero; txt.rectTransform.anchorMax = Vector2.one; txt.rectTransform.offsetMin = Vector2.zero; txt.rectTransform.offsetMax = Vector2.zero; txt.alignment = TextAnchor.MiddleCenter; txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf"); txt.color = Color.black; txt.fontSize = 16; txt.text = n.ToString();
        } else {
          var txt = t.GetComponentInChildren<Text>(); if (txt) txt.text = n.ToString();
        }
      }
    }

    // ========== Battle ==========
    void StartBattle(int island, int level, bool replay) {
      var team = selection.Select(s => (s.id, s.index)).ToList();
      BuildBattle(island, level, team, replay);
    }

    void BuildBattle(int island, int level, List<(string id,int index)> team, bool replay) {
      ClearUI(); battleEnded = false; sunBuffUntil = 0f; killedEnemies = 0;
      // background
      var bgKey = new []{"bg-jungle","bg-beach","bg-village","bg-fog","bg-desert"}[Mathf.Clamp(island-1,0,4)];
      var bg = UI.Image(_root, LoadSprite(bgKey), new Vector2(960, 540), Vector2.zero); bg.rectTransform.anchorMin = new Vector2(0.5f,0.5f); bg.rectTransform.anchorMax = new Vector2(0.5f,0.5f);
      UI.Label(_root, $"Бой — Остров {island}, Уровень {level}", 22, new Vector2(-400, 220), TextAnchor.MiddleLeft);
      UI.Label(_root, "5 vs 5", 18, new Vector2(400, 220), TextAnchor.MiddleRight);

      // Build teams
      playerTeam = BuildTeamFromSelection(team);
      while (playerTeam.Count < 5) playerTeam.Add(null);
      enemyTeam = GenerateMonsterTeam(island, level).Select(u => (Unit?)u).ToList();

      // Layout
      playerSprites = new List<Image>(); enemySprites = new List<Image>(); playerHpFg = new List<Image>(); enemyHpFg = new List<Image>();
      float leftX = -240, rightX = 240; float topY = 120; float gapY = 70; float hpW = 120f;
      for (int i = 0; i < 5; i++) {
        float y = topY - i*gapY;
        var p = playerTeam[i];
        if (p.HasValue) {
          var s = UI.Image(_root, LoadSprite(p.Value.spriteKey), new Vector2(60,60), new Vector2(leftX, y)); playerSprites.Add(s);
          var bar = UI.Bar(_root, new Vector2(hpW,10), new Vector2(leftX-40, y+28), new Color(0.18f,0.89f,0.42f)); playerHpFg.Add(bar.fg);
        } else { playerSprites.Add(null); playerHpFg.Add(null); }
        var e = enemyTeam[i];
        if (e.HasValue) {
          var s2 = UI.Image(_root, LoadSprite(e.Value.spriteKey), new Vector2(60,60), new Vector2(rightX, y)); s2.color = new Color(0.47f,1f,0.53f); enemySprites.Add(s2);
          var bar2 = UI.Bar(_root, new Vector2(hpW,10), new Vector2(rightX-40, y+28), new Color(1f,0.35f,0.35f)); enemyHpFg.Add(bar2.fg);
        } else { enemySprites.Add(null); enemyHpFg.Add(null); }
      }

      // Start loops
      for (int i = 0; i < 5; i++) { if (playerTeam[i].HasValue) StartCoroutine(CoAttacker(true, i, island, level, replay)); if (enemyTeam[i].HasValue) StartCoroutine(CoAttacker(false, i, island, level, replay)); }
      // Anubis aura
      if (playerTeam.Any(u => u.HasValue && u.Value.id == "anubis")) StartCoroutine(CoAnubisAura());
    }

    IEnumerator CoAttacker(bool isPlayer, int startIndex, int island, int level, bool replay) {
      while (!battleEnded) {
        var unit = isPlayer ? playerTeam[startIndex] : enemyTeam[startIndex]; if (!unit.HasValue || !unit.Value.alive) yield return null; else yield return new WaitForSeconds(1f / Mathf.Max(0.05f, unit.Value.atkSpeed));
        if (battleEnded) break; unit = isPlayer ? playerTeam[startIndex] : enemyTeam[startIndex]; if (!unit.HasValue || !unit.Value.alive) continue;
        // find target
        var opp = isPlayer ? enemyTeam : playerTeam; int targetIndex = NearestLivingIndex(opp, startIndex);
        if (targetIndex == -1) { OnTeamWiped(isPlayer ? "enemy" : "player", island, level, replay); yield break; }
        var target = opp[targetIndex].Value;
        // bastin invuln vs monsters first 3s
        if (!isPlayer && target.id == "bastin" && Time.time < target.invulnUntil) continue;
        int damage = unit.Value.atk;
        if (isPlayer && Time.time < sunBuffUntil) damage *= 3;
        target.currentHp -= damage;
        // update
        if (target.currentHp <= 0) {
          target.currentHp = 0; target.alive = false; if (isPlayer) { killedEnemies++; MaybeBonusStone(); }
          if (isPlayer) enemyTeam[targetIndex] = target; else playerTeam[targetIndex] = target;
          var s = (isPlayer ? enemySprites : playerSprites)[targetIndex]; if (s) s.color = new Color(s.color.r, s.color.g, s.color.b, 0.2f);
          var bar = (isPlayer ? enemyHpFg : playerHpFg)[targetIndex]; if (bar) UI.SetBar01(bar, 0, 120);
          if (!opp.Any(u => u.HasValue && u.Value.alive)) { OnTeamWiped(isPlayer ? "enemy" : "player", island, level, replay); yield break; }
        } else {
          if (isPlayer) { enemyTeam[targetIndex] = target; var bar = enemyHpFg[targetIndex]; if (bar) UI.SetBar01(bar, target.currentHp/(float)target.hp, 120); }
          else { playerTeam[targetIndex] = target; var bar = playerHpFg[targetIndex]; if (bar) UI.SetBar01(bar, target.currentHp/(float)target.hp, 120); }
        }

        // Specials
        if (isPlayer && unit.Value.faction == "robot") StartCoroutine(CoRobotBurst(startIndex));
        if (isPlayer && unit.Value.id == "geomis") StartCoroutine(CoMeteorHit());
        if (isPlayer && unit.Value.id == "starlord") StartCoroutine(CoStarLordAoE());
        if (!isPlayer && unit.Value.id == "bossCloud") StartCoroutine(CoCloudSummon());
      }
    }

    IEnumerator CoAnubisAura() {
      while (!battleEnded) { sunBuffUntil = Time.time + 2f; yield return new WaitForSeconds(3f); }
    }
    IEnumerator CoRobotBurst(int startIndex) {
      yield return new WaitForSeconds(2f); if (battleEnded) yield break; var opp = enemyTeam; int ti = NearestLivingIndex(opp, startIndex); if (ti==-1) yield break; var t = opp[ti].Value; int dmg = (playerTeam[startIndex]!.Value.atk)*2; if (Time.time < sunBuffUntil) dmg *= 3; t.currentHp -= dmg; if (t.currentHp<=0){ t.currentHp=0;t.alive=false; killedEnemies++; MaybeBonusStone(); enemyTeam[ti]=t; var s=enemySprites[ti]; if(s) s.color=new Color(s.color.r,s.color.g,s.color.b,0.2f); var bar=enemyHpFg[ti]; if(bar) UI.SetBar01(bar,0,120); if(!enemyTeam.Any(u=>u.HasValue&&u.Value.alive)) OnTeamWiped("enemy", 0,0,false);} else { enemyTeam[ti]=t; var bar=enemyHpFg[ti]; if(bar) UI.SetBar01(bar,t.currentHp/(float)t.hp,120);} }
    IEnumerator CoMeteorHit() {
      yield return new WaitForSeconds(3f); if (battleEnded) yield break; var livingIdx = new List<int>(); for(int j=0;j<enemyTeam.Count;j++) if(enemyTeam[j].HasValue && enemyTeam[j]!.Value.alive) livingIdx.Add(j); if (livingIdx.Count==0) yield break; int ti = livingIdx[Random.Range(0,livingIdx.Count)]; var t = enemyTeam[ti].Value; int dmg = (playerTeam.First(u=>u.HasValue && u.Value.id=="geomis").Value.atk)*3; if (Time.time < sunBuffUntil) dmg*=3; t.currentHp -= dmg; if (t.currentHp<=0){ t.currentHp=0; t.alive=false; killedEnemies++; MaybeBonusStone(); enemyTeam[ti]=t; var s=enemySprites[ti]; if(s) s.color=new Color(s.color.r,s.color.g,s.color.b,0.2f); var bar=enemyHpFg[ti]; if(bar) UI.SetBar01(bar,0,120);} else { enemyTeam[ti]=t; var bar=enemyHpFg[ti]; if(bar) UI.SetBar01(bar,t.currentHp/(float)t.hp,120);} if(!enemyTeam.Any(u=>u.HasValue&&u.Value.alive)) OnTeamWiped("enemy",0,0,false);
    }
    IEnumerator CoStarLordAoE() {
      yield return new WaitForSeconds(5f); if (battleEnded) yield break; bool anyKilled=false; for(int j=0;j<enemyTeam.Count;j++){ if(!enemyTeam[j].HasValue||!enemyTeam[j]!.Value.alive) continue; var t = enemyTeam[j]!.Value; int dmg = (playerTeam.First(u=>u.HasValue && u.Value.id=="starlord").Value.atk)*2; if (Time.time<sunBuffUntil) dmg*=3; t.currentHp -= dmg; if (t.currentHp<=0){ t.currentHp=0; t.alive=false; anyKilled=true; killedEnemies++; MaybeBonusStone(); enemyTeam[j]=t; var s=enemySprites[j]; if(s) s.color=new Color(s.color.r,s.color.g,s.color.b,0.2f); var bar=enemyHpFg[j]; if(bar) UI.SetBar01(bar,0,120);} else { enemyTeam[j]=t; var bar=enemyHpFg[j]; if(bar) UI.SetBar01(bar, t.currentHp/(float)t.hp, 120);} } if(!enemyTeam.Any(u=>u.HasValue&&u.Value.alive)) OnTeamWiped("enemy",0,0,false);
    }
    IEnumerator CoCloudSummon() {
      yield return new WaitForSeconds(3f); if (battleEnded) yield break; var emptyIdx = new List<int>(); for(int j=0;j<enemyTeam.Count;j++){ if(j==2) continue; if(!enemyTeam[j].HasValue) emptyIdx.Add(j); }
      if (emptyIdx.Count==0) yield break; int slot = emptyIdx[Random.Range(0, emptyIdx.Count)]; var summoned = new Unit{ id=$"summonedBlue{Random.Range(0,100000)}", name="Призванный", hp=5000, atk=500, atkSpeed=1f, currentHp=5000, alive=true, spriteKey="stickman-blue", faction="robot"};
      enemyTeam[slot] = summoned; var s2 = UI.Image(_root, LoadSprite("stickman-blue"), new Vector2(56,56), new Vector2(240, 120 - slot*70)); enemySprites[slot] = s2; var bar = UI.Bar(_root, new Vector2(120,10), new Vector2(200, 148 - slot*70), new Color(0.4f,0.73f,1f)); enemyHpFg[slot] = bar.fg;
    }

    void MaybeBonusStone() { if (Random.value < 0.5f) State.Instance.AddStones(1); }

    void OnTeamWiped(string side, int island, int level, bool replay) {
      if (battleEnded) return; battleEnded = true;
      foreach (var u in playerTeam) { }
      var panel = UI.Panel(_root, "End", new Vector2(580, 300), Vector2.zero).GetComponent<RectTransform>();
      bool win = side == "enemy";
      UI.Label(panel, win?"You won!":"Game Over", 28, new Vector2(0, -110));
      if (win) {
        if (island == 5 && level == 10) {
          if (!replay && !State.Instance.IsLevelCompleted(island, level)) { State.Instance.AddStarScrolls(3); State.Instance.AddStones(50); State.Instance.MarkLevelCompleted(island, level); UI.Label(panel, "Награды: +3 звёздных свитка, +50 камней жизни", 18, new Vector2(0, -50)); }
          else { State.Instance.AddStones(5); UI.Label(panel, "Награды: +5 камней жизни", 18, new Vector2(0,-50)); }
        } else if (island == 1 && level == 10) {
          if (!replay && !State.Instance.IsLevelCompleted(island, level)) { State.Instance.AddStarScrolls(1); State.Instance.AddStones(25); State.Instance.MarkLevelCompleted(island, level); UI.Label(panel, "Награды: +1 звёздный свиток, +25 камней жизни", 18, new Vector2(0,-50)); }
          else { State.Instance.AddStones(5); UI.Label(panel, "Награды: +5 камней жизни", 18, new Vector2(0,-50)); }
        } else {
          int baseStones = 5; if (!replay) State.Instance.AddScrolls(1); State.Instance.AddStones(baseStones); if (!replay) State.Instance.MarkLevelCompleted(island, level);
          UI.Label(panel, $"Награды: {(replay?"—":"+1 свиток, ")}+{baseStones} камней жизни", 18, new Vector2(0,-50));
        }
      }
      var toMenu = UI.Button(panel, "В главное меню", new Vector2(220,54), new Vector2(0, 60), () => BuildMainMenu());
      if (win) UI.Button(panel, "К карте", new Vector2(220,54), new Vector2(0, 120), () => BuildMap());
    }

    // ========== Inventory ==========
    void BuildInventory() {
      ClearUI(); UI.Label(_root, "Инвентарь", 28, new Vector2(-400,220), TextAnchor.MiddleLeft); UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), () => BuildMainMenu());
      var s = State.Instance; var stonesText = UI.Label(_root, $"Камни жизни: {s.data.lifeStones}", 18, new Vector2(-400, 180), TextAnchor.MiddleLeft);
      var scrollsText = UI.Label(_root, $"Свитки: {s.data.scrolls}", 18, new Vector2(-100, 180), TextAnchor.MiddleLeft);
      int page = 0; int per = 6; List<(GameObject card,string id,int idx, Button upBtn)> cardsList = new();
      System.Action render = null; render = () => {
        foreach (var c in cardsList) Destroy(c.card); cardsList.Clear();
        var flat = new List<(string id,int idx)>(); foreach (var id in CharactersConfig.ORDER) { var lst = s.GetInstances(id); for (int i = 0; i < lst.Count; i++) flat.Add((id,i)); }
        int start = page*per; int end = Mathf.Min(flat.Count, start+per); int pos=0; int baseX=-320, baseY=120, gx=210, gy=196;
        for (int i=start;i<end;i++) { int col=pos%3, row=pos/3; pos++; var e=flat[i]; var card = UI.Panel(_root, "Card", new Vector2(190,176), new Vector2(baseX+col*gx, baseY-row*gy));
          var up = s.GetUpgradeLevelInstance(e.id, e.idx); var cdef = CharactersConfig.DEF[e.id]; var st = s.GetCharacterDisplayStatsForUpgrade(e.id, up);
          UI.Image(card.transform, LoadSprite(cdef.SpriteKey), new Vector2(56,56), new Vector2(-66,-18)); UI.Label(card.transform, $"{cdef.Name} #{e.idx+1}", 18, new Vector2(-20,-50), TextAnchor.MiddleLeft);
          UI.Label(card.transform, cdef.Class, 14, new Vector2(-20,-22), TextAnchor.MiddleLeft);
          UI.Label(card.transform, $"HP {st.Item1}\nATK {st.Item2}\nSPD {st.Item3}/с", 14, new Vector2(-80,6), TextAnchor.UpperLeft);
          UI.Label(card.transform, $"Уровень: {up}/10", 14, new Vector2(-80, 56), TextAnchor.MiddleLeft);
          int target = Mathf.Min(10, up+1); int cost = s.GetUpgradeCost(e.id, target);
          var btn = UI.Button(card.transform, up>=10?"MAX":$"Апгрейд ({cost})", new Vector2(140,36), new Vector2(0,78), ()=>{ if (s.ApplyUpgradeInstance(e.id, e.idx)) { render(); stonesText.text=$"Камни жизни: {s.data.lifeStones}"; }});
          if (up>=10 || s.data.lifeStones < cost) btn.interactable = false; cardsList.Add((card, e.id, e.idx, btn));
          var del = UI.Button(card.transform, "×", new Vector2(18,18), new Vector2(88,-66), ()=>{ if (s.DeleteInstance(e.id, e.idx)) { render(); stonesText.text=$"Камни жизни: {s.data.lifeStones}"; } });
        }
        if (page>0) UI.Button(_root, "<", new Vector2(80,40), new Vector2(-60,-60), ()=>{ page--; render(); });
        if (end<flat.Count) UI.Button(_root, ">", new Vector2(80,40), new Vector2(60,-60), ()=>{ page++; render(); });
      }; render();
    }

    // ========== Summon ==========
    void BuildSummon(bool star) {
      ClearUI(); UI.Label(_root, star?"Звёздный призыв":"Призыв", 28, new Vector2(-400,220), TextAnchor.MiddleLeft); UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), ()=>BuildMainMenu());
      var info = UI.Label(_root, "", 18, new Vector2(-380, 160), TextAnchor.UpperLeft);
      System.Func<string> infoText = () => {
        var s = State.Instance.data; if (!star) {
          return $"Свитков: {s.scrolls}\nШансы:\n" + string.Join("\n", CharactersConfig.ORDER.Select(id=>$"- {CharactersConfig.DEF[id].Name}: {CharactersConfig.DEF[id].Chance}%"));
        } else {
          return $"Свитков: {s.starScrolls}\nШансы (звёздный):\n" + string.Join("\n", CharactersConfig.STAR_ORDER.Select(id=>$"- {CharactersConfig.DEF[id].Name}: {CharactersConfig.STAR_CHANCE[id]}%"));
        }
      };
      info.text = infoText();
      var result = UI.Label(_root, "—", 26, new Vector2(0, 20));
      var sprite = UI.Image(_root, LoadSprite("ui-button"), new Vector2(110,110), new Vector2(0, -60));
      var btn = UI.Button(_root, "Призвать (1 свиток)", new Vector2(260,64), new Vector2(0, -180), ()=>{
        var st = State.Instance; if (!(star ? st.UseStarScroll() : st.UseScroll())) return; string picked;
        if (!star) picked = Utils.ChoiceWeighted(CharactersConfig.ORDER.Select(id => (id, CharactersConfig.DEF[id].Chance)).ToList(), new System.Random());
        else picked = Utils.ChoiceWeighted(CharactersConfig.STAR_ORDER.Select(id => (id, CharactersConfig.STAR_CHANCE[id])).ToList(), new System.Random());
        st.OwnCharacter(picked, 1); var c = CharactersConfig.DEF[picked]; result.text = (star?"Звёздный герой: ":"Выпал герой: ") + c.Name; sprite.sprite = LoadSprite(c.SpriteKey); info.text = infoText(); RefreshResources();
      });
      StartCoroutine(CoRefreshSummon(btn, star));
    }
    IEnumerator CoRefreshSummon(Button btn, bool star) { while (btn) { var s=State.Instance.data; btn.interactable = (!star? s.scrolls>0 : s.starScrolls>0); yield return null; } }

    // ========== Achievements ==========
    void BuildAchievements() {
      ClearUI(); UI.Label(_root, "Достижения", 28, new Vector2(-400,220), TextAnchor.MiddleLeft); UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), ()=>BuildMainMenu());
      // Три строки: текущие стадии серий 1,2,3
      var entries = GetAchievementEntries(); float y = 80f;
      foreach (var ent in entries) { var row = UI.Panel(_root, "AchRow", new Vector2(640,90), new Vector2(0, y)); y -= 110f;
        UI.Label(row.transform, ent.name, 18, new Vector2(-280, 16), TextAnchor.MiddleLeft);
        UI.Label(row.transform, ent.desc, 14, new Vector2(-280, -4), TextAnchor.MiddleLeft);
        var bar = UI.Bar(row.transform, new Vector2(200,12), new Vector2(220, -6), new Color(0.31f,0.89f,0.76f));
        int progress; int need; bool claimable; (progress, need, claimable) = GetAchievementProgress(ent);
        UI.SetBar01(bar.fg, Mathf.Min(1f, progress/(float)need), 200f);
        UI.Label(row.transform, $"{progress} / {need} ({Mathf.FloorToInt(100f*Mathf.Min(1f, progress/(float)need))}%)", 14, new Vector2(220, 10));
        var btn = UI.Button(row.transform, claimable?"Забрать":"—", new Vector2(140,36), new Vector2(280, 6), ()=>{ if (claimable) { ClaimAchievement(ent.id); BuildAchievements(); } }); if (!claimable) btn.interactable=false; }
    }
    (string id,string name,string desc,int need)[] GetAchievementEntries() {
      var s = State.Instance.data; return new []{
        ("1","Убийца","Убить 100 монстров",100), ("2","Призыватель","Потратить 50 свитков",50), ("3","Первые шаги","Пройти первый остров",1)
      };
    }
    (int progress,int need,bool claimable) GetAchievementProgress((string id,string name,string desc,int need) ent) {
      var s = State.Instance.data; if (ent.id=="1") { int p=s.achievements.monstersKilled; return (p, 100, p>=100); }
      if (ent.id=="2") { int p=s.achievements.scrollsSpent; return (p, 50, p>=50); }
      // islands completed
      int islands=0; foreach (var kv in s.completed) if (kv.Value.All(b=>b)) islands++; return (islands, 1, islands>=1);
    }
    void ClaimAchievement(string id) {
      var s = State.Instance; if (id=="1") { s.AddScrolls(2); } else if (id=="2") { s.AddStarScrolls(1); } else { s.AddScrolls(5); }
      RefreshResources();
    }

    // ========== Donation ==========
    void BuildDonation() {
      ClearUI(); UI.Label(_root, "Дерево даров", 28, new Vector2(-400,220), TextAnchor.MiddleLeft); UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), ()=>BuildMainMenu());
      var progressText = UI.Label(_root, "", 18, new Vector2(0, 120)); var stonesText = UI.Label(_root, "", 18, new Vector2(0, 90)); System.Action refresh = () => {
        var s = State.Instance.data; progressText.text = $"Пожертвовано: {s.donation.progress} | Всего набрано (суммарно): {s.donation.total}"; stonesText.text = $"Камни жизни: {s.lifeStones}"; };
      refresh();
      UI.Button(_root, "Пожертвовать камень жизни", new Vector2(320,64), new Vector2(0, -180), ()=>{
        var res = State.Instance.DonateOneStone(); refresh(); if (!res.ok) return; if (res.reward.HasValue) { var r = res.reward.Value; if (r.type=="scroll") State.Instance.AddScrolls((int)r.value); if (r.type=="starScroll") State.Instance.AddStarScrolls((int)r.value); if (r.type=="character") State.Instance.OwnCharacter((string)r.value, 1); refresh(); RefreshResources(); }
      });
    }

    // ========== Settings ==========
    void BuildSettings() { ClearUI(); UI.Label(_root, "Настройки", 28, new Vector2(-400,220), TextAnchor.MiddleLeft); UI.Button(_root, "Назад", new Vector2(140,44), new Vector2(380,220), ()=>BuildMainMenu());
      var state = State.Instance; UI.Button(_root, $"Звук: {(state.data.soundOn?"Вкл":"Выкл")}", new Vector2(260,54), new Vector2(-200, 120), ()=>{ state.data.soundOn=!state.data.soundOn; state.Save(); BuildSettings(); });
      var qBtn = UI.Button(_root, $"Графика: {state.data.graphicsQuality}", new Vector2(260,54), new Vector2(-200, 50), ()=>{ var q = new[]{"low","medium","high"}; int idx = System.Array.IndexOf(q, state.data.graphicsQuality); state.data.graphicsQuality = q[(idx+1)%q.Length]; state.Save(); BuildSettings(); });
      var vBtn = UI.Button(_root, $"Музыка: {state.data.musicVolume}", new Vector2(260,54), new Vector2(-200, -20), ()=>{ var v=new[]{"low","medium","high"}; int idx=System.Array.IndexOf(v, state.data.musicVolume); state.data.musicVolume = v[(idx+1)%v.Length]; state.Save(); BuildSettings(); });
    }

    // ===== Helpers =====
    Sprite LoadSprite(string key) { return Resources.Load<Sprite>($"assets/{ResolveKeyPath(key)}"); }
    string ResolveKeyPath(string key) {
      if (key.StartsWith("bg-")) return $"backgrounds/{key}";
      if (key.StartsWith("icon-")) return $"icons/{key}";
      if (key=="ui-button"||key=="star"||key=="shield"||key.StartsWith("reward-")) return $"ui/{key}";
      return key switch {
        "monster" => "sprites/characters/monster",
        _ => $"sprites/characters/{key}"
      };
    }

    List<Unit?> BuildTeamFromSelection(List<(string id,int index)> selected) {
      var list = new List<Unit?>(); foreach (var s in selected) { int up = State.Instance.GetUpgradeLevelInstance(s.id, s.index); var baseDef = CharactersConfig.DEF[s.id]; var stats = State.Instance.GetCharacterDisplayStatsForUpgrade(s.id, up);
        var u = new Unit{ id=s.id, name=baseDef.Name, faction=baseDef.Faction, hp=stats.Item1, atk=stats.Item2, atkSpeed=stats.Item3, currentHp=stats.Item1, alive=true, spriteKey=baseDef.SpriteKey, invulnUntil = (s.id=="bastin"? Time.time + 3f : 0f) };
        list.Add(u);
      } return list;
    }
    List<Unit?> GenerateMonsterTeam(int island, int level) {
      var s = GetMonsterStats(island, level); var team = new List<Unit?>(); for (int i=0;i<5;i++) team.Add(new Unit{ id=$"m{i}", name="Монстр", hp=s.hp, atk=s.atk, atkSpeed=s.atkSpeed, currentHp=s.hp, alive=true, spriteKey="monster", faction="monster" });
      if (island==5 && level==10) team[2] = new Unit{ id="bossRed", name="Красный монстр", hp=20000, atk=1750, atkSpeed=s.atkSpeed, currentHp=20000, alive=true, spriteKey="boss-red", faction="boss" };
      if (island==1 && level==10) { for (int i=0;i<5;i++) team[i]=null; team[2] = new Unit{ id="bossForest", name="Лесной босс", hp=6500, atk=250, atkSpeed=2, currentHp=6500, alive=true, spriteKey="boss-forest", faction="boss" }; }
      if (island==4 && level==10) { for (int i=0;i<5;i++) team[i]=null; team[2] = new Unit{ id="bossCloud", name="Облачный босс", hp=12000, atk=400, atkSpeed=1, currentHp=12000, alive=true, spriteKey="boss-cloud", faction="boss" }; }
      return team;
    }
    (int hp,int atk,int atkSpeed) GetMonsterStats(int island, int level) { int baseIndex = (island-1)*10 + level; return (100*baseIndex, 10*baseIndex, 1); }
    int NearestLivingIndex(List<Unit?> living, int startIndex) { int n=living.Count; int best=-1; int bestDist=int.MaxValue; for(int i=0;i<n;i++){ if(!living[i].HasValue || !living[i]!.Value.alive) continue; int d=Mathf.Abs(i-startIndex); if(d<bestDist){bestDist=d; best=i;} } return best; }
  }
}
'@
Write-CSFile (Join-Path $scriptsDst 'Game.cs') $gameCs

Write-Host "[PathHeroes] Готово. Откройте проект Unity: $unityRoot и дождитесь импорта ассетов."


