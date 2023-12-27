const RedPipe = require('./index.cjs');

/*
 *  First PIPE
 */
const first = new RedPipe()
    .pipe(msg => {
        if(typeof msg.payload !== 'number') msg.payload = 0; // Set
        msg.payload += 5; // Update
        return msg;
    })
    .pipe((msg, node) => {
        for(let i=0; i < msg.payload; i++)
            node.send({ ...msg, payload: i }); // Multiple output
    })
    .pipe((msg, node) => {
        node.async(); // Lock
        setTimeout(() => {
            node.send(msg);
            node.async(true); // Unlock
        }, 10);
    })
    .pipe(msg => {
        if(msg.payload&1) { // is even
            second.send(msg); // Send to Second PIPE
            return msg; // Out
        }
        if(msg.payload > 10)
            throw Error('10 items or greater are not supported'); // Trigger Error
    });

/* Events */
first
    .on(RedPipe.EVENT_ERROR, ({ payload: e }) => { // Capture Errors
        console.error('[ERR]', e);
    })
    .on(RedPipe.EVENT_FINISHED, ({ payload }) => { // Batch is finished
        console.log(`FINISHED: IN ${payload.inputs} -> OUT ${payload.outputs}`);
        if(payload.errors) console.log(`  /!\\ ${payload.errors} error(s) /!\\`);
    })

/*
 *  Second PIPE
 */
const TOPIC_AWESOME = 'Awesome';
const second = new RedPipe()
    .pipe(msg => {
        if((Math.random()*2)&1)
            msg.topic = TOPIC_AWESOME; // Alter Topic
        return msg;
    })

/* Events */
second
    .on(RedPipe.EVENT_DATA, ({ payload }) => { // Final outputs
        console.log('[OUT]', payload);
    })

/* Subscribe Queue */
second
    .subscribe(TOPIC_AWESOME, ({ topic, payload }) => { // Topic: 'Awesome'
        console.log(`topic: ${topic}\npayload: ${payload}`); // Debug
    })

/*
 *  Example
 */
first.send({
    topic: 'test',
    payload: 10
});