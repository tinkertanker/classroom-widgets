### **Basic setup:**

`npm install` to install all req. packages

`npm update` to update packages (you won’t need this at all, don’t do it)

`npm start` to run the web application on http://localhost:3000/

### The current master branch contains all of the widgets (or at least it should).

### Create a new branch to work on your own widget to not mess up anything in the master branch.

To start working on your own widget, run `git checkout -b 'your_branch_name'` . This creates a new branch for you to work on.

Knowledge of the basic commands below are expected.

```bash
$ git pull
$ git commit -m "{your_commit_message}"
$ git push -u origin {your_branch_name}
$ git push
```

After you are done with your widget, run the following commands to merge the changes on your branch to the master branch:

```bash
$ git checkout master           # go to target branch
$ git fetch origin              # make sure you are up-to-date
$ git merge {your_branch_name}  # merge your branch into master
```

VSC has a default merge conflict resolver so just use that to resolve any conflicts you may have when merging to master.
