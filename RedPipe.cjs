class RedPipe {
    static TOPIC_ANY = '*';
    static TOPIC_ERROR = 'RedPipe::Error';
    static TOPIC_FINISHED = 'RedPipe::Finished';
    static TOPIC_DEFAULT = 'message';
    static TOPIC_ENUM = [
        RedPipe.TOPIC_ANY,
        RedPipe.TOPIC_ERROR,
        RedPipe.TOPIC_FINISHED
    ];
    static EVENT_DATA = 'data';
    static EVENT_ERROR = 'error';
    static EVENT_FINISHED = 'finished';
    static STATS_DEFAULT = {
        inputs: 0,
        outputs: 0, 
        errors: 0
    };

    constructor() {
        this._start = 0;
        this._reader = 0;
        this._nbJobs = 0;
        this._nbData = 0;
        this._nbAsync = 0;
        this._jobs = [];
        this._data = [];
        this._topics = [];
        this._subscribers = [];
        this._stats = { ...RedPipe.STATS_DEFAULT };
        this._running = false;
    }

    /*
     *  Pipeline
     */

    async run() {
        if(!this._nbJobs || !this._nbData) {
            if(!this._nbAsync) return this.__finished();
            return this;
        }
        while(this._reader < this._nbJobs) {
            const msg = this._data[this._reader].shift();
            if(msg) {
                const node = this.getNode(msg);
                try {
                    node.send(this._jobs[this._reader](msg, node));
                } catch(e) {
                    this._stats.errors++;
                    this.publish({
                        topic: RedPipe.TOPIC_ERROR,
                        payload: e,
                        msg
                    });
                }
                this._nbData--;
                this._reader++;
                break;
            } else {
                this._start = Math.max(this._start, this._reader+1);
            }
            this._reader++;
        }
        this._reader = Math.max(this._start, this._reader % this._nbJobs);
        setTimeout(() => this.run(), 0);
        return this;
    }

    pipe(callback) {
        this._jobs.push(callback);
        this._data.push([]);
        this._nbJobs++;
        return this;
    }

    send({ topic, payload, ...options }={}) {
        if(!this._nbJobs) return this;
        this._data[0].push({
            ...options,
            topic: topic || RedPipe.TOPIC_DEFAULT,
            payload: payload ?? null
        });
        this._start = 0;
        this._stats.inputs++;
        this._running = true;
        /* Start the sequence */
        if(!this._nbData) {
            this._nbData++;
            this._reader = 0;
            this.run();
        } else {
            this._nbData++;
        }
        return this;
    }

    isMessage(obj) {
        return typeof obj?.topic === 'string' &&
            typeof obj?.payload !== 'undefined';
    }

    __finished() {
        if(!this._running) return;
        this.publish({
            topic: RedPipe.TOPIC_FINISHED,
            payload: { ...this._stats }
        });
        this._stats = { ...RedPipe.STATS_DEFAULT };
        this._running = false;
        return this;
    }

    /*
     *  Publisher/Subscriber
     */

    publish(msg, topic=null) {
        if(!this.isMessage(msg)) return this;
        if(!topic) topic = msg.topic;
        let finder = this._topics.indexOf(topic);
        if(finder >= 0) {
            for(let subscriber of this._subscribers[finder])
                subscriber(msg);
        }
        if(RedPipe.TOPIC_ENUM.indexOf(topic) < 0)
            this.publish(msg, RedPipe.TOPIC_ANY);
        return this;
    }

    subscribe(topic=RedPipe.TOPIC_ANY, callback) {
        if(typeof topic !== 'string' || !topic.length) return;
        if(typeof callback !== 'function') return;
        let finder = this._topics.indexOf(topic);
        if(finder < 0) {
            finder = this._topics.length;
            this._topics.push(topic);
            this._subscribers.push([]);
        }
        this._subscribers[finder].push(callback);
        return () => this.unsubscribe(topic, callback);
    }

    unsubscribe(topic=RedPipe.TOPIC_ANY, callback) {
        if(typeof topic !== 'string' || !topic.length) return false;
        if(typeof callback !== 'function') return false;
        let finder = this._topics.indexOf(topic);
        if(finder >= 0) {
            const index = this._subscribers.indexOf(callback);
            if(index) {
                this._subscribers.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    on(typeEvent, callback) {
        if(typeEvent === RedPipe.EVENT_DATA)
            this.subscribe(RedPipe.TOPIC_ANY, callback);
        if(typeEvent === RedPipe.EVENT_ERROR)
            this.subscribe(RedPipe.TOPIC_ERROR, callback);
        if(typeEvent === RedPipe.EVENT_FINISHED)
            this.subscribe(RedPipe.TOPIC_FINISHED, callback);
        return this;
    }

    /*
     *  Builder
     */

    getNode(msg, index=this._reader) {
        const node = {
            _async: 0,
            send: msg => this.__send(msg, node, index+1),
            retry: () => this.__send(msg, node, index),
            async: (noLock=false) => {
                if(!noLock && node._async === 0) {
                    node._async = 1;
                    this._nbAsync++;
                } else if(node._async === 1) {
                    node._async = 2;
                    this._nbAsync--;
                }
                return node.async;
            }
        };
        return node;
    }

    __send(msg, node, index) {
        if(!this.isMessage(msg)) return;
        if(index < this._nbJobs) {
            const pos = Math.floor(Math.random() * this._data[index].length);
            this._data[index].splice(pos, 0, msg);
            this._start = Math.min(this._start, Math.max(0, index-1));
            if(!this._nbData) {
                this._nbData++;
                this._reader = Math.max(this._start, this._reader % this._nbJobs);
                this.run(); // continue
            } else {
                this._nbData++;
            }
            return msg;
        } else {
            this._stats.outputs++;
            this.publish(msg);
            node.async(true);
            if(this._running && !this._nbData && !this._nbAsync) {
                this.__finished();
            }
        }
        return;
    }
}

module.exports = RedPipe;