$proc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','start','--','-p','3000' -WorkingDirectory (Get-Location) -RedirectStandardOutput '..\fe-3000.log' -RedirectStandardError '..\fe-3000.err.log' -WindowStyle Hidden -PassThru
Write-Output "Started frontend PID $($proc.Id)"
