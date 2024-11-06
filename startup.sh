#!/bin/bash
BASEDIR=$(pwd)

java -classpath collatex/lib/\* -Dapp.name="collatex-server" -Dapp.repo="collatex/lib" -Dapp.home="collatex" -Dbasedir="collatex" eu.interedition.collatex.http.Server &
COLLATEXPID=$!

python2 python/bottle_server.py $BASEDIR

kill $COLLATEXPID
