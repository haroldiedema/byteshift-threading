"use strict";Object.defineProperty(exports,"__esModule",{value:!0});var e,t=require("worker_threads"),s=("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self&&self,{exports:{}});function r(e,t){const s={};for(const r of(e=>{let t=[],s=e;do{t=t.concat(Object.getOwnPropertyNames(s)),s=Object.getPrototypeOf(s)}while(s);return t.sort().filter(((t,s,r)=>{if(!1===t.startsWith("__")&&-1===["arguments","caller","callee","constructor","hasOwnProperty","isPrototypeOf","main","propertyIsEnumerable","toLocaleString","toString","valueOf"].indexOf(t)&&t!==r[s+1]&&"function"==typeof e[t])return!0}))})(e.prototype))s[r]=async(...e)=>await t(r,e);return s}!function(e){class t{constructor(e,t,s,r=!1){this.emitter=e,this.name=t,this.callback=s,this.isOnce=r}emit(...e){this.callback(...e),this.isOnce&&this.emitter.off(this)}unsubscribe(){this.emitter.off(this)}}e.EventEmitter=class{constructor(){this._events=new Map,this._emitted=new Set}once(e,t){return this.on(e,t,!0)}on(e,s,r){this._events.has(e)||this._events.set(e,new Set);const i=new t(this,e,s,r);return this._events.get(e).add(i),i}off(e){this._events.has(e.name)&&this._events.get(e.name).delete(e)}emit(e,...t){if("*"===e)throw new Error('Event "*" cannot be emitted.');this._events.has("*")&&this._events.get("*").forEach((s=>s.emit(e,...t))),this._events.has(e)?(this._events.get(e).forEach((e=>e.emit(...t))),this._emitted.add(e)):this._emitted.add(e)}async when(e){return this._emitted.has(e)?Promise.resolve():new Promise((t=>{this.once(e,(()=>t()))}))}},e.EventSubscriber=t,Object.defineProperty(e,"__esModule",{value:!0})}(s.exports),function(e){e[e.INIT=0]="INIT",e[e.READY=1]="READY",e[e.CREATE_PORT=2]="CREATE_PORT",e[e.CONNECT_PORT=3]="CONNECT_PORT",e[e.REQUEST=4]="REQUEST",e[e.RESPONSE=5]="RESPONSE",e[e.EVENT=6]="EVENT",e[e.LOG=7]="LOG"}(e||(e={}));class i extends s.exports.EventEmitter{worker;svcId;port;proxy={};queue=new Map;pass=[];constructor(e,s=null){super(),this.worker=s,this.svcId=e.name,this.proxy=r(e,((e,t)=>this.runMethod(e,t))),t.isMainThread?this.worker&&this.handleResponseEventFrom(s):this.handleResponseEventFrom(t.parentPort)}transferObject(e){this.pass.push(e)}get delegate(){return this.proxy}on(e,s,r){return t.isMainThread||this.port||this.createPort().then((()=>{})),super.on(e,s,r)}async runMethod(s,r){return t.isMainThread?new Promise((t=>{if(!this.worker)throw new Error(`Unable to call ${s}(). ${this.svcId} has not been started.`);const i=this.generateFreeMessageId();this.queue.set(i,t),this.worker.postMessage({type:e.REQUEST,mId:i,name:s,args:r},this.pass),this.pass=[]})):(void 0===this.port&&await this.createPort(),new Promise((t=>{const i=this.generateFreeMessageId();this.queue.set(i,t),this.port.postMessage({type:e.REQUEST,mId:i,name:s,args:r},this.pass),this.pass=[]})))}async createPort(){return new Promise((s=>{const r=this.generateFreeMessageId();this.queue.set(r,(e=>{this.port=e,this.handleResponseEventFrom(e),s()})),t.parentPort.postMessage({type:e.CREATE_PORT,mId:r,data:{svcId:this.svcId}})}))}handleResponseEventFrom(t){t.setMaxListeners(256),t.on("message",(t=>{switch(t.type){case e.RESPONSE:return void(this.queue.has(t.mId)&&(this.queue.get(t.mId)(t.result),this.queue.delete(t.mId)));case e.EVENT:return void this.emit(t.eventName,t.eventData)}}))}generateFreeMessageId(){const e=Math.floor(2147483646*Math.random());return this.queue.has(e)?this.generateFreeMessageId():e}}class n extends s.exports.EventEmitter{host;serviceClass;threadCount;onBusyCallback;bootstrapFile;exitCleanlyOnThreadCrash;threads=new Map;proxy;constructor(e,t,s,i,n,a=!1){super(),this.host=e,this.serviceClass=t,this.threadCount=s,this.onBusyCallback=i,this.bootstrapFile=n,this.exitCleanlyOnThreadCrash=a,this.proxy=r(t,((e,t)=>this.runMethod(e,t)))}onBusy(e){this.onBusyCallback=e}get hasIdleThreads(){for(const e of this.threads.values())if(!e.isBusy)return!0;return!1}get busyThreadCount(){let e=0;for(const t of this.threads.values())t.isBusy&&e++;return e}get isStarted(){for(let e of this.threads.values())if(!e.isRunning)return!1;return!0}get delegate(){return this.proxy}get service(){return this.serviceClass}start(){let e,t=0;return this.on("childOnline",(()=>{t++,t===this.threadCount&&e()})),new Promise((t=>{e=t;for(let e=0;e<this.threadCount;e++)this.threads.set(e+1,this.spawnThread(e+1))}))}spawnThread(s){const r=new t.Worker(this.bootstrapFile,{env:t.SHARE_ENV}),n=new i(this.serviceClass,r);this.configureMultiThreadCommunicationEvents(r);const a={id:s,worker:r,thread:n,isRunning:!1,isBusy:!1,queue:new Set};return r.on("error",(e=>{this.emit("log",{level:"emergency",message:`Thread "${this.serviceClass.name}" crashed. Error: ${e.message}. Trace: ${e.stack}`}),setTimeout((()=>{process.exit(this.exitCleanlyOnThreadCrash?0:1)}),1e3)})),r.on("online",(()=>{this.emit("log",{level:"debug",message:`Service thread #${r.threadId} "${this.serviceClass.name}" is online.`}),this.host.emit("add",{thread:n,worker:r,service:this.serviceClass})})),r.on("exit",(()=>{this.emit("log",{level:"warning",message:`Service thread "${this.serviceClass.name}" is terminated.`})})),r.postMessage({type:e.INIT,svc:this.serviceClass.name,poolId:s}),n.once("__running__",(async()=>{this.emit("log",{level:"debug",message:`Service thread #${r.threadId} "${this.serviceClass.name}" is successfully initialized.`}),a.isRunning=!0,this.emit("childOnline",a)})),a}async runMethod(e,t){const s=this.findFreeThread();return s.isBusy&&"function"==typeof this.onBusyCallback?this.onBusyCallback():new Promise((r=>{s.queue.add(r),s.isBusy=!0,this.emit("tick"),s.thread.delegate[e](...t).then((e=>{s.queue.delete(r),s.isBusy=!1,r(e),this.emit("tick")})).catch((e=>{console.error(e)}))}))}findFreeThread(){let e,t=1/0;for(let s of this.threads.values()){if(!s.isBusy)return s;t>s.queue.size&&(t=s.queue.size,e=s)}return e}configureMultiThreadCommunicationEvents(s){s.on("message",(async r=>{if(r.type!==e.CREATE_PORT)return;const{port1:i,port2:n}=new t.MessageChannel;(await this.host.getWorkerByName(r.data.svcId)).postMessage({type:e.CONNECT_PORT,port:n},[n]),s.postMessage({type:e.RESPONSE,mId:r.mId,poolId:r.poolId||void 0,result:i},[i])}))}}const a="undefined"!=typeof window?window:global;class o extends s.exports.EventEmitter{exitCleanlyOnThreadCrash=!1;bootstrapFile=null;services=new Map;pools=new Map;static getInstance(){return void 0!==a.__ByteshiftThreading__?a.__ByteshiftThreading__:a.__ByteshiftThreading__=new o}constructor(){if(super(),void 0!==a.__ByteshiftThreading__)throw new Error("Use ThreadHost.getInstance() to grab an instance of the ThreadHost.")}initialize(e,t=!1){this.bootstrapFile=e,this.exitCleanlyOnThreadCrash=t}register(...e){if(!this.bootstrapFile)throw new Error("Unable to register a threadable class without initializing the ThreadHost first. Please call .initialize() first.");e.forEach((e=>{if(this.services.has(e.name))throw new Error(`Another threaded service with the name "${e.name}" is already registered.`);this.services.set(e.name,{service:e,thread:null,worker:null})}))}registerPool(e,t,s){if(!this.bootstrapFile)throw new Error("Unable to register a thread pool without initializing the ThreadHost first. Please call .initialize() first.");if(this.pools.has(e.name))throw new Error(`Another thread pool already exists for service class "${e.name}".`);this.pools.set(e.name,new n(this,e,t,s,this.bootstrapFile,this.exitCleanlyOnThreadCrash))}get(e){if(!t.isMainThread)throw new Error("A child thread can only be retrieved from the main thread.");if(!1===this.services.has(e.name))throw new Error(`Thread "${e.name}" does not exist or is not registered.`);if(!this.services.get(e.name).thread)throw new Error(`Unable to retrieve thread "${e.name}" because it is not started.`);return this.services.get(e.name).thread}getPool(e){if(!t.isMainThread)throw new Error("A thread pool can only be retrieved from the main thread.");if(!1===this.pools.has(e.name))throw new Error(`A thread pool for "${e.name}" does not exist or is not registered.`);const s=this.pools.get(e.name);if(!1===s.isStarted)throw new Error(`Thread pool for service "${e.name}" has not been started.`);return s}async start(...e){if(!t.isMainThread)throw new Error("A thread can only be started from the main thread.");for(let t of e)await this._start(t)}async startPool(...e){if(!t.isMainThread)throw new Error("A thread pool can only be started from the main thread.");for(let t of e){if(!this.pools.has(t.name))throw new Error(`There is no thread pool for service class "${t.name}".`);await this.pools.get(t.name).start()}}_start(s){const r=this.bootstrapFile;return new Promise((n=>{const a=new t.Worker(r,{env:t.SHARE_ENV}),o=new i(s,a);a.on("error",(e=>{this.emit("log",{level:"emergency",message:`Thread "${s.name}" crashed. Error: ${e.message}. Trace: ${e.stack}`}),setTimeout((()=>{process.exit(this.exitCleanlyOnThreadCrash?1:0)}),1e3)})),a.on("online",(()=>{this.emit("log",{level:"debug",message:`Service thread #${a.threadId} "${s.name}" is online.`}),this.emit("add",this.services.get(s.name))})),a.on("exit",(()=>{this.emit("log",{level:"warning",message:`Service thread "${s.name}" is terminated.`}),this.emit("remove",this.services.get(s.name))})),this.configureMultiThreadCommunicationEvents(a),this.services.get(s.name).thread=o,this.services.get(s.name).worker=a,a.postMessage({type:e.INIT,svc:s.name}),o.once("__running__",(async()=>{this.emit("log",{level:"debug",message:`Service thread #${a.threadId} "${s.name}" is successfully initialized.`}),n(o)}))}))}getWorkerByName(e){if(!t.isMainThread)throw new Error(`A child thread attempted to fetch the worker for service "${e}" directly.`);const s=this.services.get(e);if(!s)throw new Error(`The worker for "${e}" is offline.`);return s.worker}getClass(e){if(!1===this.services.has(e)){if(!1===this.pools.has(e))throw new Error(`Threadable service "${e}" does not exist.`);return this.pools.get(e).service}return this.services.get(e).service}configureMultiThreadCommunicationEvents(s){s.on("message",(async r=>{if(r.type!==e.CREATE_PORT)return;const{port1:i,port2:n}=new t.MessageChannel;(await this.getWorkerByName(r.data.svcId)).postMessage({type:e.CONNECT_PORT,port:n},[n]),s.postMessage({type:e.RESPONSE,mId:r.mId,poolId:r.poolId||void 0,result:i},[i])}))}}class h extends s.exports.EventEmitter{async ping(){return"pong"}}exports.Delegate=function(e){return function(s,r){let n;Object.defineProperty(s,r,{configurable:!1,enumerable:!1,get:()=>(n||(n=t.isMainThread?new i(e,o.getInstance().getWorkerByName(e.name)):new i(e)),n)})}},exports.DelegatePool=function(e){return function(s,r){Object.defineProperty(s,r,{configurable:!1,enumerable:!1,get:()=>{if(!t.isMainThread)throw new Error("A thread pool can only be accessed from the main thread.");return o.getInstance().getPool(e)}})}},exports.Thread=h,exports.ThreadContext=class{serviceId="N/A";poolId=null;queue=new Map;service;async run(){if(!0===t.isMainThread)throw new Error("this.run cannot be executed from the main thread.");t.parentPort.on("message",(async s=>{switch(s.type){case e.INIT:return this.serviceId=s.svc,this.service=new(o.getInstance().getClass(s.svc)),this.poolId=s.poolId||void 0,t.parentPort.setMaxListeners(256),this.handleRequestMessagesFromPort(t.parentPort),await this.service.__init__(),void t.parentPort.postMessage({type:e.EVENT,eventName:"__running__",eventData:null});case e.RESPONSE:if(!this.queue.has(s.mId))return;return this.queue.get(s.mId)(s.data),void this.queue.delete(s.mId);case e.CONNECT_PORT:return s.port.setMaxListeners(256),void this.handleRequestMessagesFromPort(s.port)}}))}handleRequestMessagesFromPort(t){t.on("message",(async s=>{s.type===e.REQUEST&&("function"==typeof this.service[s.name]?t.postMessage({type:e.RESPONSE,mId:s.mId,poolId:this.poolId,result:await this.service[s.name](...s.args)}):console.warn(`Method ${s.name} does not exist in thread "${this.serviceId}".`))})),this.service instanceof s.exports.EventEmitter&&this.service.on("*",((s,r)=>{t.postMessage({type:e.EVENT,eventName:s,eventData:r})}))}},exports.ThreadDelegate=i,exports.ThreadHost=o,exports.ThreadPool=n;
//# sourceMappingURL=index.js.map
