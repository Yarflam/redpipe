# RedPipe

![license](https://img.shields.io/badge/license-CC0--v1.0-green.svg)

## Install

```bash
git clone https://github.com/Yarflam/redpipe.git
```

Run `test.cjs`:

```bash
npm test
```

## Usages

Import the library:

```javascript
const RedPipe = require('redpipe');
```

Create a new pipeline:

```javascript
const flow = new RedPipe();
```

Add a simple pipe (return same object):

```javascript
flow.pipe(msg => {
    msg.payload = 'Hello World';
    return msg; // return the current object
});
```

Add a separation pipe (multiple objects):

```javascript
flow.pipe((msg, node) => {
    node.send({ ...msg, payload: 'First' });
    node.send({ ...msg, payload: 'Second' });
    return; // no return (= useless)
});
```

Add a bridge pipe (send to another pipeline):

```javascript
flow.pipe((msg, node) => {
    secondFlow.send({ ...msg, payload: 'Hello' });
});
```

Add an async pipe:

```javascript
flow.pipe((msg, node) => {
    node.async(); // Lock
    setTimeout(() => {
        node.send(msg);
        node.async(true); // Unlock
    }, 42);
});
```

### Events

Capture the errors:

```javascript
flow.on(
    RedPipe.EVENT_ERROR,
    ({ payload: e }) => {
        console.error('[ERR]', e);
    }
)
```

Capture the finished state:

```javascript
flow.on(
    RedPipe.EVENT_FINISHED,
    ({ payload }) => {
        const { inputs, outputs, errors } = payload;
        console.log(`FINISHED: IN ${inputs} -> OUT ${outputs}`);
        if(errors) console.log(`  /!\\ ${errors} error(s) /!\\`);
    }
)
```

Retrieve output data:

```javascript
flow.on(
    RedPipe.EVENT_DATA,
    ({ payload }) => {
        console.log('[OUT]', payload);
        // Keep them somewhere
    }
)
```

### Subscribers (Queue)

Subscribe to a specific topic:

```javascript
flow.subscribe('MyTopic', ({ payload }) => {
    console.log('[MyTopic]', payload);
});
```

Subscribe to all topics:

```javascript
flow.subscribe(
    RedPipe.TOPIC_ANY,
    ({ topic, payload }) => {
        if(RedPipe.TOPIC_ENUM.indexOf(topic) >= 0)
            return; // Ignore the events
        console.log(`[${topic}]`, payload);
    }
);
```

### Execute the pipeline

Send a new message:

```javascript
flow.send({
    topic: 'MyTopic',
    payload: 42
});
```

## Message Object

Structure:
- topic: *string*
- payload: *string | number | array | object | boolean*
- ... support any other attributes ...

Inspired by the Node-RED model. [See more](https://nodered.org/)

## Authors

-   Yarflam - _initial work_

## License

The project is licensed under Creative Commons Zero (CC0).