"""Classify known public media/test fixtures; never print scanner matches."""
import json,re,subprocess,sys
from urllib.parse import urlsplit
known_media={
    "c565f4c30b3f38a28f4a8acfc61a6563e881e3d7",
    "4889f2e74be39b5cf88b2c4082a05772e3586d89",
}
unknown=0
for finding in json.load(open(sys.argv[1],encoding="utf-8")):
    commit=finding.get("Commit","")
    path=finding.get("File","")
    secret=finding.get("Secret","")
    verified=False
    if finding.get("RuleID")=="generic-api-key" and secret:
        if commit in known_media and path=="lib/realizo-creative/template-video-input.js":
            src=subprocess.check_output(["git","show",commit+":"+path],text=True)
            match=re.search(r"TEMPLATE_PREVIEW_PROVIDER_SRC\s*=\s*'([^']+)'",src)
            if match:
                u=urlsplit(match.group(1))
                verified=(u.scheme=="https" and u.hostname=="cdn.muapi.ai" and not u.query and not u.username and u.path.endswith(".mp4") and secret in match.group(1))
        elif commit=="4a40ffefe1033f5b3f1ed1786ac8760b84fa95d0" and path=="tests/realizo-premium-paid-languages.test.mjs":
            src=subprocess.check_output(["git","show",commit+":"+path],text=True)
            match=re.search(r"primary_asset_id:'([0-9a-f-]{36})',request_key:'([^']+)'",src)
            verified=bool(match and (secret==match.group(1) or secret==match.group(2)))
    print(json.dumps({"rule":finding.get("RuleID"),"file":path,"line":finding.get("StartLine"),"commit":commit,"classification":"reviewed noncredential fixture" if verified else "unresolved"},ensure_ascii=True))
    unknown+=not verified
print("Unresolved potential credentials:",unknown)
sys.exit(23 if unknown else 0)
