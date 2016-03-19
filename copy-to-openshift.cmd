set OPENSHIFT_FOLDER=..\OpenShift\todo

xcopy /Y /S ".\node_modules\" ".\%OPENSHIFT_FOLDER%\node_modules\"
xcopy /Y /S ".\public" ".\%OPENSHIFT_FOLDER%\public"
xcopy /Y ".\*.js" ".\%OPENSHIFT_FOLDER%\*"
xcopy /Y ".\*.cmd" ".\%OPENSHIFT_FOLDER%\*"
xcopy /Y ".\*.json" ".\%OPENSHIFT_FOLDER%\*"

cd ".\%OPENSHIFT_FOLDER%"
call ".\%OPENSHIFT_FOLDER%\push.cmd"