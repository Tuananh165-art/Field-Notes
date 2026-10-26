param(
  [string]$OutputFile = "Field_Notes_Source.zip"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$archivePath = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputFile))
if (-not $archivePath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Output ZIP must be inside the project folder."
}

$excludedDirectoryNames = @("node_modules", ".expo", ".npm-cache", ".expo-home", ".gomodcache", ".gocache", ".gradle-cache", ".jdk17", ".android-cli", ".android-user", "dist", "web-build", "coverage", ".git")
$filesToArchive = [Collections.Generic.List[IO.FileInfo]]::new()

function Add-SourceFiles([string]$directoryPath) {
  foreach ($entry in Get-ChildItem -LiteralPath $directoryPath -Force) {
    if ($entry.PSIsContainer) {
      if ($excludedDirectoryNames -notcontains $entry.Name) { Add-SourceFiles $entry.FullName }
      continue
    }
    if ($entry.Name -eq ".env" -or ($entry.Name.StartsWith(".env.") -and $entry.Name -ne ".env.example")) { continue }
    $filesToArchive.Add($entry)
  }
}

foreach ($sourceDirectory in @("app", "src", "backend", "docs", "scripts")) {
  Add-SourceFiles (Join-Path $projectRoot $sourceDirectory)
}
foreach ($sourceFile in @("README.md", "AI_LOG.md", "package.json", "package-lock.json", "tsconfig.json", "app.json", "app.config.js", "app.config.utils.js", "app.config.test.js", "babel.config.js", "metro.config.js", "tailwind.config.js", "eslint.config.js", "jest.config.js", "nativewind-env.d.ts", "global.css", ".gitignore", ".env.example", "docker-compose.yml", "FinalProject_Topic03_Field_Notes.docx")) {
  $candidate = Join-Path $projectRoot $sourceFile
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { $filesToArchive.Add((Get-Item -LiteralPath $candidate)) }
}

if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($source in $filesToArchive) {
    $relative = $source.FullName.Substring($projectRoot.Length + 1).Replace("\", "/")
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $source.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal)
  }
} finally {
  $archive.Dispose()
}

Write-Output "Created $archivePath with $($filesToArchive.Count) source files."
